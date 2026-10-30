[CmdletBinding()]
param(
    [switch]$Once,
    [int]$IntervalMs = 500,
    [int]$MaxNodesPerWindow = 3000
)

# Read-only fallback for CEF pages that expose their rendered text through
# Windows UI Automation. It never sends input, opens a process handle for
# writing, injects code, uses CDP, or reads any log file.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$script:lastJson = $null

function Get-HsProcessIds {
    $rows = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -in @("HSAng.exe", "browser.exe", "HSAExternal.exe")
    }
    $ids = New-Object System.Collections.Generic.HashSet[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    foreach ($row in $rows) {
        if ($row.Name -eq "HSAng.exe") {
            [void]$ids.Add([int]$row.ProcessId)
            $queue.Enqueue([int]$row.ProcessId)
        }
    }
    while ($queue.Count -gt 0) {
        $parent = $queue.Dequeue()
        foreach ($row in $rows | Where-Object { [int]$_.ParentProcessId -eq $parent }) {
            if ($ids.Add([int]$row.ProcessId)) { $queue.Enqueue([int]$row.ProcessId) }
        }
    }
    return @($ids | Sort-Object)
}

function Get-TextValue($element) {
    try {
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
            $text = $pattern.DocumentRange.GetText(-1)
            if ($text) { return ($text -replace "\s+", " ").Trim() }
        }
    } catch { }
    try {
        $valuePattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
            if ($valuePattern.Current.Value) { return $valuePattern.Current.Value }
        }
    } catch { }
    return $null
}

function Get-ElementSnapshot($element, [int]$depth, [ref]$count) {
    if ($count.Value -ge $MaxNodesPerWindow) { return $null }
    $count.Value++
    $current = $element.Current
    $item = [ordered]@{
        name = $current.Name
        controlType = $current.ControlType.ProgrammaticName
        automationId = $current.AutomationId
        className = $current.ClassName
        text = Get-TextValue $element
    }
    if ($depth -lt 12 -and $count.Value -lt $MaxNodesPerWindow) {
        try {
            $children = $element.FindAll(
                [System.Windows.Automation.TreeScope]::Children,
                [System.Windows.Automation.Condition]::TrueCondition
            )
            $childItems = @()
            foreach ($child in $children) {
                $childItem = Get-ElementSnapshot $child ($depth + 1) ([ref]$count)
                if ($null -ne $childItem) { $childItems += $childItem }
            }
            if ($childItems.Count -gt 0) { $item.children = $childItems }
        } catch { }
    }
    return $item
}

function Get-Snapshot {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $ids = @(Get-HsProcessIds)
    $windows = @()
    foreach ($processId in $ids) {
        try {
            $condition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ProcessIdProperty,
                [int]$processId
            )
            $found = $root.FindAll(
                [System.Windows.Automation.TreeScope]::Children,
                $condition
            )
            foreach ($window in $found) {
                $count = 0
                $tree = Get-ElementSnapshot $window 0 ([ref]$count)
                $windows += [ordered]@{
                    pid = $processId
                    name = $window.Current.Name
                    className = $window.Current.ClassName
                    nodes = $count
                    tree = $tree
                }
            }
        } catch { }
    }
    return [ordered]@{
        source = "hsarriver-uia-readonly"
        time = [DateTime]::UtcNow.ToString("o")
        processIds = $ids
        windows = $windows
    }
}

function Emit-Snapshot {
    $snapshot = Get-Snapshot
    $json = $snapshot | ConvertTo-Json -Depth 30 -Compress
    if ($json -ne $script:lastJson) {
        $script:lastJson = $json
        Write-Output $json
    }
}

if ($Once) {
    Emit-Snapshot
    exit 0
}

while ($true) {
    Emit-Snapshot
    Start-Sleep -Milliseconds ([Math]::Max(100, $IntervalMs))
}
