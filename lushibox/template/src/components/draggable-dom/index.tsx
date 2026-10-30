import React, { useState, useRef, useEffect } from 'react';
import './index.scss';
const DraggableElement = ({ children, initialPosition = { x: 0, y: 0 }, onPositionChange, onDrag, onClick, bounds = 'window', className = '', style = {}, }) => {
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const elementRef = useRef(null);
    const dragStartRef = useRef({ clientX: 0, clientY: 0 });
    const offsetRef = useRef({ x: 0, y: 0 });
    const wasDragged = useRef(false);
    const startTimeRef = useRef(0);
    const lastInitialPositionRef = useRef(initialPosition);
    const handleMouseDown = (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        dragStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY
        };
        offsetRef.current = position;
        setIsDragging(true);
        wasDragged.current = false;
        startTimeRef.current = Date.now();
    };
    const handleMouseMove = (e) => {
        if (!isDragging || !elementRef.current)
            return;
        const element = elementRef.current;
        const elementRect = element.getBoundingClientRect();
        const dragDistance = Math.sqrt(Math.pow(e.clientX - dragStartRef.current.clientX, 2) +
            Math.pow(e.clientY - dragStartRef.current.clientY, 2));
        if (dragDistance > 5) {
            wasDragged.current = true;
        }
        let containerWidth = window.innerWidth;
        let containerHeight = window.innerHeight;
        if (bounds === 'parent' && element.parentElement) {
            const parentRect = element.parentElement.getBoundingClientRect();
            containerWidth = parentRect.width;
            containerHeight = parentRect.height;
        }
        const deltaXPercent = ((e.clientX - dragStartRef.current.clientX) / containerWidth) * 100;
        const deltaYPercent = ((e.clientY - dragStartRef.current.clientY) / containerHeight) * 100;
        let newXPercent = offsetRef.current.x + deltaXPercent;
        let newYPercent = offsetRef.current.y + deltaYPercent;
        if (bounds) {
            const elementWidthPercent = (elementRect.width / containerWidth) * 100;
            const elementHeightPercent = (elementRect.height / containerHeight) * 100;
            newXPercent = Math.max(0, Math.min(newXPercent, 100 - elementWidthPercent));
            newYPercent = Math.max(0, Math.min(newYPercent, 100 - elementHeightPercent));
        }
        const newPosition = { x: newXPercent, y: newYPercent };
        setPosition(newPosition);
        if (onPositionChange) {
            onPositionChange(newPosition);
        }
    };
    const handleMouseUp = (e) => {
        if (!isDragging)
            return;
        const interactionTime = Date.now() - startTimeRef.current;
        setIsDragging(false);
        if (!wasDragged.current && interactionTime < 300 && onClick && elementRef.current) {
            const syntheticEvent = {
                currentTarget: elementRef.current,
                target: elementRef.current,
                preventDefault: () => { },
                stopPropagation: () => { },
                nativeEvent: e
            };
            onClick(syntheticEvent);
        }
    };
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    useEffect(() => {
        if (!isDragging && onDrag && wasDragged.current) {
            onDrag(position);
        }
    }, [isDragging, position]);
    useEffect(() => {
        if (initialPosition.x !== lastInitialPositionRef.current.x || initialPosition.y !== lastInitialPositionRef.current.y) {
            setPosition(initialPosition);
            lastInitialPositionRef.current = initialPosition;
        }
    }, [initialPosition]);
    return (React.createElement("div", { ref: elementRef, className: `draggable-element ${isDragging ? 'dragging' : ''} ${className}`, style: Object.assign(Object.assign({}, style), { top: `${position.y}%`, left: `${position.x}%`, position: 'absolute', cursor: isDragging ? 'grabbing' : 'grab' }), onMouseDown: handleMouseDown }, children));
};
export default DraggableElement;
