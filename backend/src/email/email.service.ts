import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ActivationEmailPayload = {
  to: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  tempPassword: string;
  companyName: string;
  expiresInHours: number;
  customMessage?: string;
};

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') || 587),
        secure: false,
        auth: {
          user,
          pass: this.config.get<string>('SMTP_PASS') ?? '',
        },
      });
      this.logger.log('SMTP configuré — envoi des e-mails activé');
    } else {
      this.logger.warn(
        'SMTP non configuré — e-mails en mode dégradé (journal uniquement)',
      );
    }
  }

  isSmtpConfigured(): boolean {
    return this.transporter != null;
  }

  async sendWelcomeEmail(data: {
    to: string;
    firstName: string;
    companyName: string;
  }): Promise<void> {
    const fn = escapeHtml(data.firstName);
    const cn = escapeHtml(data.companyName);
    const subject = `Bienvenue sur PaySlip Manager, ${fn} !`;
    const dashboardUrl =
      this.config.get<string>('ADMIN_WEB_URL')?.trim().replace(/\/$/, '') ??
      '';
    const ctaHref = dashboardUrl ? `${dashboardUrl}/dashboard` : '#';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0F5C5E; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">PaySlip Manager</h1>
        </div>
        <div style="background: #F8F9FA; border: 1px solid #E8E8E8; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="font-size: 16px; color: #1C2833;">Bonjour <strong>${fn}</strong>,</p>
          <p style="font-size: 14px; color: #7F8C8D; line-height: 1.6;">
            Votre espace <strong>${cn}</strong> est prêt sur PaySlip Manager.
          </p>
          <p style="font-size: 14px; color: #7F8C8D; line-height: 1.6;">
            Voici les prochaines étapes :
          </p>
          <ol style="font-size: 14px; color: #7F8C8D; line-height: 1.8; padding-left: 20px;">
            <li>Configurez votre organigramme (directions, départements, services)</li>
            <li>Importez vos collaborateurs via un fichier Excel</li>
            <li>Activez leurs comptes en un clic</li>
            <li>Déposez vos bulletins de paie</li>
          </ol>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${ctaHref}" style="background: #F28C28; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: bold;">
              Accéder à mon espace
            </a>
          </div>
        </div>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[E-MAIL SIMULÉ] Bienvenue envoyé à ${data.to}`);
      return;
    }

    const from =
      this.config.get<string>('SMTP_FROM')?.trim() ||
      'PaySlip Manager <noreply@payslip-manager.com>';

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject,
      html,
    });
  }

  async sendActivationEmail(data: ActivationEmailPayload): Promise<void> {
    const html = this.buildActivationHtml(data);
    const subject = `${data.companyName} — Votre espace PaySlip Manager est prêt`;

    if (!this.transporter) {
      this.logger.log(
        `[E-MAIL SIMULÉ] À : ${data.to} | mot de passe temporaire : ${data.tempPassword}`,
      );
      return;
    }

    const from =
      this.config.get<string>('SMTP_FROM')?.trim() ||
      'PaySlip Manager <noreply@payslip-manager.com>';

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${data.companyName} — Votre espace PaySlip Manager est prêt`,
      html,
    });
  }

  private buildActivationHtml(data: ActivationEmailPayload): string {
    const fn = escapeHtml(data.firstName);
    const ln = escapeHtml(data.lastName);
    const em = escapeHtml(data.to);
    const mat = escapeHtml(data.employeeId);
    const pwd = escapeHtml(data.tempPassword);
    const cn = escapeHtml(data.companyName);
    const custom = data.customMessage?.trim()
      ? `<p style="font-size: 13px; color: #7F8C8D; font-style: italic; border-left: 3px solid #E8E8E8; padding-left: 12px; margin: 16px 0;">${escapeHtml(data.customMessage.trim())}</p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0F5C5E; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">PaySlip Manager</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Vos bulletins, en un clic.</p>
        </div>
        <div style="background: #F8F9FA; border: 1px solid #E8E8E8; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="font-size: 16px; color: #1C2833;">Bonjour <strong>${fn} ${ln}</strong>,</p>
          <p style="font-size: 14px; color: #7F8C8D; line-height: 1.6;">
            Votre espace personnel chez <strong>${cn}</strong> est prêt.
            Vous pouvez consulter vos bulletins de paie depuis votre téléphone.
          </p>
          <div style="background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="font-size: 12px; color: #7F8C8D; margin: 0 0 4px;">VOS IDENTIFIANTS</p>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">Matricule</td>
                <td style="text-align: right; font-weight: bold; color: #1C2833;">${mat}</td>
              </tr>
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">E-mail</td>
                <td style="text-align: right; color: #0F5C5E;">${em}</td>
              </tr>
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">Mot de passe</td>
                <td style="text-align: right; font-weight: bold; color: #F28C28; font-family: monospace; font-size: 16px;">${pwd}</td>
              </tr>
            </table>
          </div>
          <div style="background: #FEF3E5; border-radius: 8px; padding: 12px; margin: 16px 0;">
            <p style="font-size: 12px; color: #854F0B; margin: 0;">
              Ce mot de passe est temporaire et expire dans <strong>${data.expiresInHours} heures</strong>.
              Vous devrez le changer lors de votre première connexion.
            </p>
          </div>
          ${custom}
          <p style="font-size: 11px; color: #BDC3C7; text-align: center; margin-top: 20px;">
            ${cn} utilise PaySlip Manager pour la distribution sécurisée de vos bulletins de paie.
          </p>
        </div>
      </div>
    `;
  }
}
