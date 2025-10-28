import { jsx as _jsx } from "react/jsx-runtime";
export const PageContainer = ({ children }) => (_jsx("div", { style: {
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0b0f19 0%, #0e1324 100%)',
        color: '#e2e8f0'
    }, children: children }));
export const NeonText = ({ children }) => (_jsx("span", { style: {
        color: '#00f0ff',
        textShadow: '0 0 12px rgba(0,240,255,0.8)'
    }, children: children }));
