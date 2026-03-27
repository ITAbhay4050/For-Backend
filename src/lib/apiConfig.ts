export const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error("❌ VITE_API_BASE is not set");
}

console.log("✅ API_BASE loaded:", API_BASE);