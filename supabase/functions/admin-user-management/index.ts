import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const DEFAULT_ALLOWED = ["http://localhost:5173", "http://localhost:3000"];
const BASE_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw?.trim()) return DEFAULT_ALLOWED;
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  return getAllowedOrigins().includes(origin) ? origin : null;
}

function corsHeadersForRequest(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return { "Access-Control-Allow-Headers": allowHeaders };
  }

  const allowed = resolveAllowedOrigin(req);
  if (!allowed) return null;

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
  };
}

function handleCorsPreflight(
  req: Request,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response("ok", { headers });
}

function jsonWithCors(
  req: Request,
  body: Record<string, unknown>,
  status: number,
  allowHeaders: string = BASE_ALLOW_HEADERS,
): Response {
  const headers = corsHeadersForRequest(req, allowHeaders);
  if (!headers) return new Response("Forbidden", { status: 403 });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

const ROLES = new Set(["admin", "reviewer", "distributor", "viewer"]);

type CreateBody = {
  action: "create";
  email: string;
  password: string;
  full_name: string;
  role: string;
};

type DeactivateBody = {
  action: "deactivate";
  user_id: string;
};

type ActivateBody = {
  action: "activate";
  user_id: string;
};

type UpdateRoleBody = {
  action: "update_role";
  user_id: string;
  role: string;
};

type RequestBody = CreateBody | DeactivateBody | ActivateBody | UpdateRoleBody;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonWithCors(req, { ok: false, message: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonWithCors(req,{ ok: false, message: "إعدادات الخادم غير مكتملة." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonWithCors(req,{ ok: false, message: "غير مصرّح." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) {
      return jsonWithCors(req,{ ok: false, message: "غير مصرّح." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: callerData.user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return jsonWithCors(req,{ ok: false, message: "يتطلب صلاحية مدير." }, 403);
    }

    const body = (await req.json()) as RequestBody;

    if (body.action === "create") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password ?? "";
      const fullName = body.full_name?.trim();
      const role = body.role;

      if (!email || !password || password.length < 8 || !fullName || !ROLES.has(role)) {
        return jsonWithCors(req,{ ok: false, message: "يرجى تعبئة جميع الحقول بشكل صحيح (كلمة المرور 8 أحرف على الأقل)." }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !created.user) {
        console.error("[admin-user-management] createUser:", createError);
        const msg = createError?.message?.includes("already")
          ? "هذا البريد مسجّل مسبقاً."
          : "تعذّر إنشاء المستخدم.";
        return jsonWithCors(req,{ ok: false, message: msg }, 400);
      }

      const { error: roleError } = await admin.from("user_roles").insert({
        user_id: created.user.id,
        role,
        is_active: true,
      });

      if (roleError) {
        console.error("[admin-user-management] role insert:", roleError);
        await admin.auth.admin.deleteUser(created.user.id);
        return jsonWithCors(req,{ ok: false, message: "تعذّر تعيين الدور." }, 500);
      }

      return jsonWithCors(req,{ ok: true, user_id: created.user.id }, 200);
    }

    if (body.action === "deactivate") {
      const userId = body.user_id;
      if (!userId) return jsonWithCors(req,{ ok: false, message: "معرّف المستخدم مطلوب." }, 400);
      if (userId === callerData.user.id) {
        return jsonWithCors(req,{ ok: false, message: "لا يمكنك تعطيل حسابك." }, 400);
      }

      const { error: roleError } = await admin
        .from("user_roles")
        .update({ is_active: false })
        .eq("user_id", userId);

      if (roleError) {
        console.error("[admin-user-management] deactivate role:", roleError);
        return jsonWithCors(req,{ ok: false, message: "تعذّر تعطيل المستخدم." }, 500);
      }

      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });

      if (banError) {
        console.error("[admin-user-management] ban user:", banError);
        return jsonWithCors(req,{ ok: false, message: "تعذّر حظر الحساب." }, 500);
      }

      return jsonWithCors(req,{ ok: true }, 200);
    }

    if (body.action === "activate") {
      const userId = body.user_id;
      if (!userId) return jsonWithCors(req,{ ok: false, message: "معرّف المستخدم مطلوب." }, 400);

      const { error: roleError } = await admin
        .from("user_roles")
        .update({ is_active: true })
        .eq("user_id", userId);

      if (roleError) {
        console.error("[admin-user-management] activate role:", roleError);
        return jsonWithCors(req,{ ok: false, message: "تعذّر تفعيل المستخدم." }, 500);
      }

      const { error: unbanError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });

      if (unbanError) {
        console.error("[admin-user-management] unban user:", unbanError);
        return jsonWithCors(req,{ ok: false, message: "تعذّر إلغاء حظر الحساب." }, 500);
      }

      return jsonWithCors(req,{ ok: true }, 200);
    }

    if (body.action === "update_role") {
      const userId = body.user_id;
      const role = body.role;
      if (!userId || !ROLES.has(role)) {
        return jsonWithCors(req,{ ok: false, message: "بيانات غير صالحة." }, 400);
      }
      if (userId === callerData.user.id && role !== "admin") {
        return jsonWithCors(req,{ ok: false, message: "لا يمكنك إزالة صلاحية المدير عن نفسك." }, 400);
      }

      const { error } = await admin.from("user_roles").update({ role }).eq("user_id", userId);
      if (error) {
        console.error("[admin-user-management] update role:", error);
        return jsonWithCors(req,{ ok: false, message: "تعذّر تحديث الدور." }, 500);
      }

      return jsonWithCors(req,{ ok: true }, 200);
    }

    return jsonWithCors(req,{ ok: false, message: "عملية غير معروفة." }, 400);
  } catch (err) {
    console.error("[admin-user-management] unexpected:", err);
    return jsonWithCors(req,{ ok: false, message: "خطأ غير متوقع." }, 500);
  }
});

