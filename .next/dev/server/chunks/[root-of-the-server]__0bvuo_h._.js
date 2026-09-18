module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/lib/bus.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "listeners",
    ()=>listeners,
    "publish",
    ()=>publish
]);
const g = globalThis;
const listeners = g.__checkflowListeners ??= new Set();
function publish(event) {
    for (const listener of Array.from(listeners)){
        try {
            listener(event);
        } catch  {
        // a broken listener must not break the mutation path
        }
    }
}
}),
"[project]/src/app/api/events/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bus$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/bus.ts [app-route] (ecmascript)");
;
const dynamic = "force-dynamic";
const runtime = "nodejs";
async function GET(req) {
    const encoder = new TextEncoder();
    let listener = null;
    let ping = null;
    const cleanup = ()=>{
        if (listener) __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bus$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listeners"].delete(listener);
        listener = null;
        if (ping) clearInterval(ping);
        ping = null;
    };
    const stream = new ReadableStream({
        start (controller) {
            const send = (obj)=>{
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
                } catch  {
                    cleanup();
                }
            };
            send({
                type: "hello",
                at: new Date().toISOString()
            });
            listener = (e)=>send(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bus$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listeners"].add(listener);
            ping = setInterval(()=>{
                try {
                    controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
                } catch  {
                    cleanup();
                }
            }, 25_000);
            req.signal.addEventListener("abort", cleanup);
        },
        cancel () {
            cleanup();
        }
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no"
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0bvuo_h._.js.map