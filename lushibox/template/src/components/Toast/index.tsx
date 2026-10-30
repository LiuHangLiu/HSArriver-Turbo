var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import "./index.scss";
export default function Toast(_a) {
    return __awaiter(this, arguments, void 0, function* ({ delay = 2000, text = "提示", forever = false, postion = "center" }) {
        const container = document.body;
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = text;
        container.appendChild(toast);
        toast.offsetHeight;
        toast.classList.add(postion);
        toast.classList.add("show");
        if (forever)
            return;
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, delay);
    });
}
