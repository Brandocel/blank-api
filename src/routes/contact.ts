// src/routes/contact.ts
import { Router, type Request, type Response } from "express";
import fetch from "node-fetch";
import { Resend } from "resend";

const router = Router();

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔗 Branding base
const BRAND_URL = process.env.BRAND_URL ?? "https://blank.com.mx";

// (Si ya tienes app.use(express.json()) en server.ts, este middleware no es necesario,
// pero lo dejamos como no-op para que no estorbe)
router.use((_req, _res, next) => {
  next();
});

router.post(
  "/contact",
  async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, email, phone, message, captchaToken } =
      req.body;

    // 🔐 Validación rápida en backend
    if (!captchaToken) {
      res.status(400).json({
        success: false,
        message: "Captcha requerido",
      });
      return;
    }

    if (!firstName || !lastName || !email || !phone || !message) {
      res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
      return;
    }

    try {
      /* ===========================
         1. Validar reCAPTCHA
      ============================ */

      const secretKey = process.env.RECAPTCHA_SECRET_KEY;

      if (!secretKey) {
        console.error("❌ Falta RECAPTCHA_SECRET_KEY en .env");
        res.status(500).json({
          success: false,
          message: "Configuración del captcha incompleta",
        });
        return;
      }

      const googleRes = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `secret=${secretKey}&response=${captchaToken}`,
        }
      );

      const captchaData = (await googleRes.json()) as any;
      console.log("✅ CAPTCHA DATA:", captchaData);

      if (!captchaData.success) {
        res.status(400).json({
          success: false,
          message: "Captcha inválido",
          detail: captchaData,
        });
        return;
      }

      /* ===========================
         2. Validar configuración de Resend
      ============================ */

      if (!process.env.RESEND_API_KEY) {
        console.error("❌ Falta RESEND_API_KEY en .env");
        res.status(500).json({
          success: false,
          message: "Configuración de correo incompleta (RESEND_API_KEY).",
        });
        return;
      }

      const to = process.env.CONTACT_TO_EMAIL || undefined;
      const cc = process.env.CONTACT_CC_EMAIL || "";

      if (!to) {
        console.error("❌ No hay CONTACT_TO_EMAIL configurado en .env");
        res.status(500).json({
          success: false,
          message: "No hay correo de destino configurado",
        });
        return;
      }

      /* ===========================
         3. Construir y enviar el correo con Resend
      ============================ */

      const subject = `[Contacto Web] Nuevo mensaje de ${firstName} ${lastName}`;

      const textBody = `
Has recibido un nuevo mensaje desde el formulario de contacto de blank.com.mx

────────────────────────────
DATOS DEL CONTACTO
────────────────────────────
Nombre:   ${firstName} ${lastName}
Email:    ${email}
Teléfono: ${phone}

────────────────────────────
MENSAJE
────────────────────────────
${message}

────────────────────────────
META
────────────────────────────
Fecha:  ${new Date().toLocaleString("es-MX")}
Origen: Formulario de contacto (www.blank.com.mx)
      `;

      const htmlBody = `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Nuevo mensaje de contacto</title>
  </head>
  <body style="margin:0; padding:0; background-color:#020617;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617; padding:32px 16px 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px; width:100%;">
            <!-- HEADER -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <!-- Marca (solo texto) -->
                <div style="
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:26px;
                  font-weight:700;
                  letter-spacing:0.28em;
                  text-transform:uppercase;
                  color:#f9fafb;
                ">
                  BLANK
                </div>

                <!-- Línea divisoria sutil -->
                <div style="margin:14px auto 12px auto; width:72px; height:1px; background:linear-gradient(to right,#4b5563,#9ca3af,#4b5563);"></div>

                <!-- Subtítulo -->
                <div style="
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:12px;
                  letter-spacing:0.16em;
                  text-transform:uppercase;
                  color:#9ca3af;
                ">
                  Nuevo mensaje de contacto
                </div>

                <!-- Descripción corta -->
                <div style="
                  margin-top:8px;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:13px;
                  color:#9ca3af;
                ">
                  Has recibido un mensaje desde el formulario de contacto de blank.com.mx
                </div>
              </td>
            </tr>

            <!-- CARD PRINCIPAL -->
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" style="
                  border-radius:18px;
                  background-color:#020617;
                  border:1px solid rgba(148,163,184,0.45);
                  box-shadow:0 18px 38px rgba(15,23,42,0.7);
                  padding:22px 20px 22px 20px;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                ">
                  <!-- Encabezado del contacto -->
                  <tr>
                    <td style="padding-bottom:16px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:top;">
                            <div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:4px;">
                              Detalles del mensaje
                            </div>
                            <div style="font-size:18px; font-weight:600; color:#f9fafb; line-height:1.3;">
                              ${firstName} ${lastName}
                            </div>
                            <div style="font-size:11px; color:#6b7280; margin-top:4px;">
                              Enviado el ${new Date().toLocaleString("es-MX")}
                            </div>
                          </td>
                          <td style="vertical-align:top;" align="right">
                            <!-- Chip origen -->
                            <div style="
                              display:inline-block;
                              padding:6px 12px;
                              border-radius:999px;
                              border:1px solid rgba(148,163,184,0.7);
                              font-size:10px;
                              letter-spacing:0.16em;
                              text-transform:uppercase;
                              color:#e5e7eb;
                              background:rgba(15,23,42,0.85);
                            ">
                              www.blank.com.mx
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Línea separadora -->
                  <tr>
                    <td style="padding-bottom:12px;">
                      <div style="height:1px; background-color:rgba(148,163,184,0.35);"></div>
                    </td>
                  </tr>

                  <!-- DATOS DEL CONTACTO -->
                  <tr>
                    <td style="padding-bottom:12px;">
                      <div style="
                        font-size:11px;
                        font-weight:600;
                        text-transform:uppercase;
                        letter-spacing:0.12em;
                        color:#9ca3af;
                        margin-bottom:8px;
                      ">
                        Datos del contacto
                      </div>

                      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#e5e7eb;">
                        <tr>
                          <td width="28%" style="padding:4px 0; color:#9ca3af;">Nombre</td>
                          <td style="padding:4px 0;">${firstName} ${lastName}</td>
                        </tr>
                        <tr>
                          <td style="padding:4px 0; color:#9ca3af;">Correo</td>
                          <td style="padding:4px 0;">
                            <a href="mailto:${email}" style="color:#60a5fa; text-decoration:none;">
                              ${email}
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:4px 0; color:#9ca3af;">Teléfono</td>
                          <td style="padding:4px 0;">
                            <a href="tel:${phone}" style="color:#e5e7eb; text-decoration:none;">
                              ${phone}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Línea separadora -->
                  <tr>
                    <td style="padding-bottom:10px;">
                      <div style="height:1px; background-color:rgba(148,163,184,0.30);"></div>
                    </td>
                  </tr>

                  <!-- MENSAJE -->
                  <tr>
                    <td>
                      <div style="
                        font-size:11px;
                        font-weight:600;
                        text-transform:uppercase;
                        letter-spacing:0.12em;
                        color:#9ca3af;
                        margin-bottom:8px;
                      ">
                        Mensaje
                      </div>
                      <div style="
                        font-size:14px;
                        line-height:1.7;
                        color:#e5e7eb;
                        white-space:pre-wrap;
                      ">
                        ${String(message || "").replace(/\n/g, "<br>")}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td align="center" style="padding-top:16px;">
                <div style="
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:11px;
                  color:#6b7280;
                ">
                  Este correo fue generado automáticamente desde el formulario de contacto de
                  <a href="${BRAND_URL}" style="color:#9ca3af; text-decoration:underline;">blank.com.mx</a>.
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `;

      console.log("📧 Enviando correo (Resend) a:", { to, cc });

      const sendResult = await resend.emails.send({
        from: "BLANK · Formulario Web <onboarding@resend.dev>", // luego cámbialo por tu dominio verificado
        to: [to],
        cc: cc ? [cc] : undefined,
        reply_to: email, // así puedes responder directo al cliente
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log("✅ Resend result:", sendResult);

      res.json({
        success: true,
        message: "Mensaje enviado correctamente",
      });
    } catch (error: any) {
      // ⛔ Aquí atrapamos cualquier error inesperado
      console.error("❌ Error en /contact:", error);
      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);

      res.status(500).json({
        success: false,
        message: "Error interno al enviar el mensaje",
        detail: msg, // lo ves en el Network tab
      });
    }
  }
);

export default router;
