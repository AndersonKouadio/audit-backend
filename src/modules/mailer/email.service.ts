import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Service d'envoi d'emails via SMTP (nodemailer).
 *
 * Configuration requise dans .env :
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=noreply@example.com
 *   SMTP_PASS=secret
 *   SMTP_FROM="Audit Interne <noreply@example.com>"
 *
 * Installation requise :
 *   npm install nodemailer
 *   npm install -D @types/nodemailer
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: any | null = null;

  constructor(private readonly config: ConfigService) {
    this.initTransporter();
  }

  // ─── Initialisation du transporteur SMTP ──────────────────────────────────

  private async initTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        '⚠️  SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS manquants). ' +
          "Les emails ne seront pas envoyés. Ajoutez ces variables dans votre fichier .env.",
      );
      return;
    }

    try {
      // Import dynamique pour éviter de crasher si nodemailer n'est pas installé
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = await (async () => { try { return require('nodemailer'); } catch { return null; } })();
      if (!nodemailer) {
        this.logger.error(
          '❌ nodemailer n\'est pas installé. Exécutez : npm install nodemailer @types/nodemailer',
        );
        return;
      }

      this.transporter = nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }, // Pour les certs auto-signés en développement
      });

      // Vérification de la connexion
      await this.transporter.verify();
      this.logger.log(`✅ Connexion SMTP établie sur ${host}:${port}`);
    } catch (error: any) {
      this.logger.error(`❌ Échec de connexion SMTP : ${error.message}`);
      this.transporter = null;
    }
  }

  // ─── Envoi d'un email ─────────────────────────────────────────────────────

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`📧 [SIMULATION] Email non envoyé (SMTP non configuré) → ${payload.to} : ${payload.subject}`);
      return false;
    }

    const from = this.config.get<string>('SMTP_FROM', 'Audit Interne <noreply@audit.ci>');

    try {
      const info = await this.transporter.sendMail({
        from,
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text ?? payload.subject,
      });

      this.logger.log(`✅ Email envoyé → ${payload.to} [${info.messageId}]`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Erreur d'envoi email → ${payload.to} : ${error.message}`);
      return false;
    }
  }

  // ─── Templates d'emails ───────────────────────────────────────────────────

  buildRelanceTemplate(params: {
    reference: string;
    titre: string;
    dateEcheance: string;
    destinataire: string;
    organisationName?: string;
  }): string {
    const org = params.organisationName ?? 'Audit Interne';
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #1a3c6b; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .alert-box { background: #fff3cd; border-left: 4px solid #ff9800; border-radius: 4px; padding: 16px; margin: 20px 0; }
    .point-ref { font-size: 22px; font-weight: bold; color: #1a3c6b; }
    .footer { background: #f0f0f0; padding: 16px 32px; font-size: 12px; color: #666; text-align: center; }
    .btn { display: inline-block; background: #1a3c6b; color: #fff; padding: 10px 24px; border-radius: 4px; text-decoration: none; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Relance — Point d'Audit en Retard</h1>
      <p style="margin:4px 0 0;opacity:.8;">${org}</p>
    </div>
    <div class="body">
      <p>Bonjour,</p>
      <p>Le point d'audit suivant est <strong>en retard</strong> et nécessite votre attention :</p>
      <div class="alert-box">
        <div class="point-ref">${params.reference}</div>
        <div style="margin-top:8px;">${params.titre}</div>
        <div style="margin-top:4px; color:#e53935;">📅 Échéance dépassée : ${params.dateEcheance}</div>
      </div>
      <p>Merci de mettre à jour le statut du constat ou de déclarer votre avancement dans l'outil de suivi.</p>
      <a class="btn" href="#">Accéder au constat</a>
    </div>
    <div class="footer">
      Cet email est envoyé automatiquement par le système de suivi des audits — ${org}.<br>
      Ne pas répondre à cet email.
    </div>
  </div>
</body>
</html>`;
  }

  buildRetourCpfTemplate(params: {
    reference: string;
    organisationName?: string;
  }): string {
    const org = params.organisationName ?? 'Audit Interne';
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #c62828; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .info-box { background: #fce4ec; border-left: 4px solid #c62828; border-radius: 4px; padding: 16px; margin: 20px 0; }
    .footer { background: #f0f0f0; padding: 16px 32px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Retour automatique CPF → Ouvert</h1>
      <p style="margin:4px 0 0;opacity:.8;">${org}</p>
    </div>
    <div class="body">
      <p>Bonjour équipe Audit,</p>
      <div class="info-box">
        <strong>${params.reference}</strong><br>
        Le point d'audit a été automatiquement <strong>remis au statut OUVERT</strong> car il est resté plus de <strong>30 jours</strong> en attente de validation sans action.
      </div>
      <p>Merci de prendre en charge ce point et de relancer le processus de validation.</p>
    </div>
    <div class="footer">
      Notification automatique — Système de suivi des audits — ${org}
    </div>
  </div>
</body>
</html>`;
  }

  buildChangementStatutTemplate(params: {
    reference: string;
    titre: string;
    ancienStatut: string;
    nouveauStatut: string;
    modifiePar: string;
    organisationName?: string;
  }): string {
    const org = params.organisationName ?? 'Audit Interne';
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #2e7d32; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .statut-box { display: flex; gap: 16px; align-items: center; margin: 20px 0; }
    .chip { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    .footer { background: #f0f0f0; padding: 16px 32px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Changement de statut — ${params.reference}</h1>
      <p style="margin:4px 0 0;opacity:.8;">${org}</p>
    </div>
    <div class="body">
      <p>Bonjour,</p>
      <p>Le statut du constat <strong>${params.reference} — ${params.titre}</strong> vient d'être modifié :</p>
      <div class="statut-box">
        <span class="chip" style="background:#ffcdd2;color:#c62828;">${params.ancienStatut}</span>
        <span>→</span>
        <span class="chip" style="background:#c8e6c9;color:#2e7d32;">${params.nouveauStatut}</span>
      </div>
      <p><strong>Modifié par :</strong> ${params.modifiePar}</p>
    </div>
    <div class="footer">
      Notification automatique — Système de suivi des audits — ${org}
    </div>
  </div>
</body>
</html>`;
  }

  buildDailyDigestTemplate(params: {
    totalPoints: number;
    pointsEnRetard: number;
    pointsEnValidation: number;
    pointsFermes: number;
    date: string;
    organisationName?: string;
  }): string {
    const org = params.organisationName ?? 'Audit Interne';
    const tauxCloture = params.totalPoints > 0
      ? Math.round((params.pointsFermes / params.totalPoints) * 100)
      : 0;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #1565c0; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }
    .kpi-card { background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
    .kpi-value { font-size: 32px; font-weight: bold; display: block; margin-bottom: 4px; }
    .kpi-label { font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600; }
    .kpi-danger .kpi-value { color: #c62828; }
    .kpi-warning .kpi-value { color: #e65100; }
    .kpi-success .kpi-value { color: #2e7d32; }
    .kpi-primary .kpi-value { color: #1565c0; }
    .footer { background: #f0f0f0; padding: 16px 32px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Résumé quotidien — Audit Interne</h1>
      <p style="margin:4px 0 0;opacity:.8;">${params.date} — ${org}</p>
    </div>
    <div class="body">
      <p>Bonjour,</p>
      <p>Voici la synthèse des points d'audit au <strong>${params.date}</strong> :</p>
      <div class="kpi-grid">
        <div class="kpi-card kpi-primary">
          <span class="kpi-value">${params.totalPoints}</span>
          <span class="kpi-label">Total Points</span>
        </div>
        <div class="kpi-card kpi-danger">
          <span class="kpi-value">${params.pointsEnRetard}</span>
          <span class="kpi-label">Points en Retard</span>
        </div>
        <div class="kpi-card kpi-warning">
          <span class="kpi-value">${params.pointsEnValidation}</span>
          <span class="kpi-label">En Validation</span>
        </div>
        <div class="kpi-card kpi-success">
          <span class="kpi-value">${tauxCloture}%</span>
          <span class="kpi-label">Taux de Clôture</span>
        </div>
      </div>
      <p style="color:#666;font-size:13px;">Ce résumé est envoyé automatiquement chaque matin. Vous pouvez désactiver cet envoi dans les paramètres système.</p>
    </div>
    <div class="footer">
      Résumé automatique — ${org}
    </div>
  </div>
</body>
</html>`;
  }
}
