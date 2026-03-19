import { z } from "zod";

export const PasswordSchema = z
  .string()
  .min(8, "密码至少 8 个字符")
  .max(128, "密码最多 128 个字符")
  .refine(
    (pw) => /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw),
    "密码需包含字母和数字"
  );
