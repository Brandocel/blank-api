// src/routes/careers.ts
import { Router, type Request, type Response } from "express";
import fetch from "node-fetch";
import { Resend } from "resend";
import multer from "multer";

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Multer en memoria para adjuntar el CV al correo
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
});

router.post(
  "/careers",
  upload.single("cvFile"),
  async (req: Request, res: Response): Promise<void> => {
    const {
      firstName,
      lastName,
      email,
      phone,
      message,
      portfolio,
      captchaToken,
    } = req.body as {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      message?: string;
      portfolio?: string;
      captchaToken?: string;
    };

    const file = (req as any).file as Express.Multer.File | undefined;

    // 🔐 Validaciones básicas
    if (!captchaToken) {
      res.status(400).json({
        success: false,
        message: "Captcha requerido",
      });
      return;
    }

    if (!firstName || !lastName || !email || !phone) {
      res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios",
      });
      return;
    }

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Debes adjuntar tu CV.",
      });
      return;
    }

    // Formatos permitidos
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        message: "Formato de CV no permitido (usa PDF, JPG o PNG).",
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
          message: "Configuración del captcha incompleta.",
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
      console.log("✅ CAPTCHA DATA Careers:", captchaData);

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

      const to = process.env.CAREERS_TO_EMAIL || process.env.CONTACT_TO_EMAIL;
      const cc = process.env.CAREERS_CC_EMAIL || "";

      if (!to) {
        console.error("❌ No hay CAREERS_TO_EMAIL/CONTACT_TO_EMAIL configurado");
        res.status(500).json({
          success: false,
          message: "No hay correo de destino configurado.",
        });
        return;
      }

      /* ===========================
         3. Construir correo (texto + HTML + adjunto)
      ============================ */

      const subject = `[Careers] Nueva aplicación de ${firstName} ${lastName}`;

      const textBody = `
Has recibido una nueva aplicación desde la sección Careers de blank.com.mx

────────────────────────────
DATOS DEL CANDIDATO
────────────────────────────
Nombre:    ${firstName} ${lastName}
Correo:    ${email}
Teléfono:  ${phone}
Portafolio:${portfolio || "No especificado"}

────────────────────────────
MENSAJE
────────────────────────────
${message || "Sin mensaje adicional."}

────────────────────────────
CV ADJUNTO
────────────────────────────
Archivo: ${file.originalname}
Tipo:    ${file.mimetype}
Tamaño:  ${(file.size / 1024 / 1024).toFixed(2)} MB
      `;

      const htmlBody = `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Nueva aplicación · Careers</title>
  </head>
  <body style="margin:0; padding:0; background-color:#020617;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617; padding:32px 16px 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px; width:100%;">
            <!-- HEADER -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
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
                <div style="margin:14px auto 12px auto; width:72px; height:1px; background:linear-gradient(to right,#4b5563,#9ca3af,#4b5563);"></div>
                <div style="
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:12px;
                  letter-spacing:0.16em;
                  text-transform:uppercase;
                  color:#9ca3af;
                ">
                  Nueva aplicación · Careers
                </div>
                <div style="
                  margin-top:8px;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  font-size:13px;
                  color:#9ca3af;
                ">
                  Has recibido una nueva postulación desde el formulario de Careers.
                </div>
              </td>
            </tr>

            <!-- CARD -->
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
                  <!-- Encabezado -->
                  <tr>
                    <td style="padding-bottom:16px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:top;">
                            <div style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:4px;">
                              Candidato
                            </div>
                            <div style="font-size:18px; font-weight:600; color:#f9fafb; line-height:1.3;">
                              ${firstName} ${lastName}
                            </div>
                            <div style="font-size:11px; color:#6b7280; margin-top:4px;">
                              Enviado el ${new Date().toLocaleString("es-MX")}
                            </div>
                          </td>
                          <td style="vertical-align:top;" align="right">
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
                              www.blank.com.mx · Careers
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Separador -->
                  <tr>
                    <td style="padding-bottom:12px;">
                      <div style="height:1px; background-color:rgba(148,163,184,0.35);"></div>
                    </td>
                  </tr>

                  <!-- Datos -->
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
                        Datos del candidato
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
                        <tr>
                          <td style="padding:4px 0; color:#9ca3af;">Portafolio</td>
                          <td style="padding:4px 0;">
                            ${
                              portfolio
                                ? `<a href="${portfolio}" style="color:#60a5fa; text-decoration:none;">${portfolio}</a>`
                                : "No especificado"
                            }
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Separador -->
                  <tr>
                    <td style="padding-bottom:10px;">
                      <div style="height:1px; background-color:rgba(148,163,184,0.30);"></div>
                    </td>
                  </tr>

                  <!-- Mensaje -->
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
                        ${String(message || "Sin mensaje adicional.").replace(
                          /\n/g,
                          "<br>"
                        )}
                      </div>
                      <div style="margin-top:16px; font-size:12px; color:#9ca3af;">
                        CV adjunto: <strong>${file.originalname}</strong> (${(
        file.size / 1024 / 1024
      ).toFixed(2)} MB)
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
                  Este correo fue generado automáticamente desde la sección Careers de
                  <a href="${
                    process.env.BRAND_URL ?? "https://blank.com.mx"
                  }" style="color:#9ca3af; text-decoration:underline;">blank.com.mx</a>.
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

      // 🧷 Adjuntamos el CV usando el buffer directo (descargable)
      const attachments = [
        {
          filename: file.originalname,
          content: file.buffer, // <– Buffer, NO base64
          contentType: file.mimetype,
        },
      ];

      console.log("📧 Enviando correo Careers (Resend) a:", { to, cc });

      const sendResult = await resend.emails.send({
        from: "BLANK · Careers <onboarding@resend.dev>", // cámbialo por tu dominio verificado cuando lo tengas
        to: [to],
        cc: cc ? [cc] : undefined,
        replyTo: email,
        subject,
        text: textBody,
        html: htmlBody,
        attachments,
      });

      console.log("✅ Resend careers result:", sendResult);

      res.json({
        success: true,
        message: "Aplicación enviada correctamente",
      });
    } catch (error: any) {
      console.error("❌ Error en /careers:", error);
      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);

      res.status(500).json({
        success: false,
        message: "Error interno al enviar la aplicación",
        detail: msg,
      });
    }
  }
);

export default router;
