(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__3fc89a25._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/Desktop/cmd-main/src/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2d$auth$2f$middleware$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/cmd-main/node_modules/next-auth/middleware.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Desktop/cmd-main/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Desktop/cmd-main/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
;
;
// Define which routes are protected and which roles can access them
const protectedRoutes = {
    "/dashboard": [
        "ADMIN",
        "ACCOUNTANT",
        "PROJECT_MANAGER"
    ],
    "/dashboard/admin": [
        "ADMIN"
    ],
    "/dashboard/projects": [
        "ADMIN",
        "PROJECT_MANAGER"
    ],
    "/dashboard/operational-units": [
        "ADMIN"
    ],
    "/dashboard/residents": [
        "ADMIN",
        "PROJECT_MANAGER"
    ],
    "/dashboard/tickets": [
        "ADMIN",
        "PROJECT_MANAGER"
    ],
    "/dashboard/delivery-orders": [
        "ADMIN",
        "PROJECT_MANAGER"
    ],
    "/dashboard/invoices": [
        "ADMIN",
        "ACCOUNTANT"
    ],
    "/dashboard/payments": [
        "ADMIN",
        "ACCOUNTANT"
    ],
    "/dashboard/accounting-notes": [
        "ADMIN",
        "ACCOUNTANT",
        "PROJECT_MANAGER"
    ],
    "/dashboard/staff": [
        "ADMIN",
        "ACCOUNTANT"
    ],
    "/dashboard/reports": [
        "ADMIN"
    ],
    "/dashboard/settings": [
        "ADMIN"
    ]
};
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2d$auth$2f$middleware$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["withAuth"])(function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    // Check if the path starts with /dashboard
    if (path.startsWith("/dashboard")) {
        // Find the most specific matching route
        let matchedRoute = null;
        const pathSegments = path.split("/");
        // Check from most specific to least specific
        for(let i = pathSegments.length; i >= 2; i--){
            const routePath = pathSegments.slice(0, i).join("/");
            if (protectedRoutes[routePath]) {
                matchedRoute = routePath;
                break;
            }
        }
        // Default to /dashboard if no specific route matched
        if (!matchedRoute) {
            matchedRoute = "/dashboard";
        }
        const allowedRoles = matchedRoute ? protectedRoutes[matchedRoute] : undefined;
        // Check if user has required role
        if (!token || !allowedRoles || !allowedRoles.includes(token.role)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/unauthorized", req.url));
        }
        // Redirect based on role if accessing root dashboard
        if (path === "/dashboard") {
            if (token.role === "ACCOUNTANT") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/dashboard/accountant", req.url));
            } else if (token.role === "PROJECT_MANAGER") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/dashboard/manager", req.url));
            }
        // Admin stays on /dashboard or can go to /dashboard/admin
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$Desktop$2f$cmd$2d$main$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
}, {
    callbacks: {
        authorized: ({ token })=>!!token
    }
});
const config = {
    matcher: [
        "/dashboard/:path*"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__3fc89a25._.js.map