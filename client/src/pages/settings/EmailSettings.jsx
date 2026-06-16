import { useState, useEffect } from 'react';
import * as emailApi from '@api/emailApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Input from '@components/ui/Input';
import { toast } from 'react-toastify';
import { Mail, Server, Lock, Send, CheckCircle2, AlertCircle, Loader2, Shield, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmailSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message }
  const [form, setForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_pass: '',
    from_name: '',
    from_email: '',
    reply_to: '',
    enabled: true,
  });
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await emailApi.getEmailConfig();
      if (data) {
        setForm({
          smtp_host: data.smtp_host || 'smtp.gmail.com',
          smtp_port: data.smtp_port || 587,
          smtp_secure: !!data.smtp_secure,
          smtp_user: data.smtp_user || '',
          smtp_pass: '',
          from_name: data.from_name || '',
          from_email: data.from_email || '',
          reply_to: data.reply_to || '',
          enabled: data.enabled !== false,
        });
        setHasPassword(!!data.has_password);
      }
    } catch { /* first-time setup, use defaults */ }
    finally { setLoading(false); }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await emailApi.testEmailConfig(form);
      setTestResult({ success: true, message: data.message || t('email_settings.test_success', 'Connection successful') });
      toast.success(t('email_settings.test_success', 'SMTP connection successful'));
    } catch (err) {
      const msg = err.response?.data?.error || t('email_settings.test_failed', 'Connection failed');
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally { setTesting(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.smtp_host || !form.smtp_user) {
      toast.error(t('email_settings.required_fields', 'SMTP Host and Username are required'));
      return;
    }
    setSaving(true);
    try {
      await emailApi.saveEmailConfig(form);
      toast.success(t('email_settings.saved', 'Email configuration saved'));
      setHasPassword(!!form.smtp_pass || hasPassword);
      setTestResult(null);
    } catch (err) {
      toast.error(err.response?.data?.error || t('email_settings.save_failed', 'Failed to save configuration'));
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-4 bg-surface-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-surface-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-brand-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t('email_settings.title', 'Email Configuration')}</h2>
            <p className="text-white/70 text-sm mt-0.5">{t('email_settings.subtitle', 'Configure SMTP settings for outgoing emails')}</p>
          </div>
        </div>
      </div>

      {/* SMTP Server Section */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-100 bg-surface-50/60 flex items-center gap-2">
          <Server size={16} className="text-surface-500" />
          <h3 className="font-semibold text-sm text-surface-900">{t('email_settings.smtp_server', 'SMTP Server')}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                label={t('email_settings.smtp_host', 'SMTP Host')}
                placeholder="smtp.gmail.com"
                required
                value={form.smtp_host}
                onChange={(e) => update('smtp_host', e.target.value)}
                icon={Server}
              />
            </div>
            <Input
              label={t('email_settings.smtp_port', 'SMTP Port')}
              type="number"
              placeholder="587"
              required
              value={form.smtp_port}
              onChange={(e) => update('smtp_port', parseInt(e.target.value) || '')}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtp_secure}
                onChange={(e) => update('smtp_secure', e.target.checked)}
                className="w-4 h-4 rounded border-surface-300 text-brand-600"
              />
              <Shield size={14} className="text-surface-500" />
              <span className="text-sm text-surface-700">{t('email_settings.smtp_secure', 'Use TLS/SSL Encryption')}</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Authentication Section */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-100 bg-surface-50/60 flex items-center gap-2">
          <Lock size={16} className="text-surface-500" />
          <h3 className="font-semibold text-sm text-surface-900">{t('email_settings.authentication', 'Authentication')}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('email_settings.smtp_user', 'SMTP Username')}
              placeholder="your@email.com"
              required
              value={form.smtp_user}
              onChange={(e) => update('smtp_user', e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">
                {t('email_settings.smtp_pass', 'SMTP Password')}
              </label>
              <input
                type="password"
                placeholder={hasPassword ? '(saved)' : t('email_settings.enter_password', 'Enter password')}
                value={form.smtp_pass}
                onChange={(e) => update('smtp_pass', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 input-focus transition-all duration-200"
              />
              {hasPassword && !form.smtp_pass && (
                <p className="text-[10px] text-surface-400">{t('email_settings.password_saved_hint', 'Leave blank to keep existing password')}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Sender Identity Section */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-100 bg-surface-50/60 flex items-center gap-2">
          <Mail size={16} className="text-surface-500" />
          <h3 className="font-semibold text-sm text-surface-900">{t('email_settings.sender_identity', 'Sender Identity')}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('email_settings.from_name', 'From Name')}
              placeholder="IST HR System"
              value={form.from_name}
              onChange={(e) => update('from_name', e.target.value)}
            />
            <Input
              label={t('email_settings.from_email', 'From Email')}
              type="email"
              placeholder="noreply@company.com"
              value={form.from_email}
              onChange={(e) => update('from_email', e.target.value)}
            />
          </div>
          <Input
            label={t('email_settings.reply_to', 'Reply-To Address')}
            type="email"
            placeholder="hr@company.com"
            value={form.reply_to}
            onChange={(e) => update('reply_to', e.target.value)}
          />
        </div>
      </Card>

      {/* General Section */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-100 bg-surface-50/60 flex items-center gap-2">
          <Settings size={16} className="text-surface-500" />
          <h3 className="font-semibold text-sm text-surface-900">{t('email_settings.general', 'General')}</h3>
        </div>
        <div className="p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="w-4 h-4 rounded border-surface-300 text-brand-600"
            />
            <div>
              <span className="text-sm font-medium text-surface-900">{t('email_settings.enabled', 'Enable Email Sending')}</span>
              <p className="text-xs text-surface-400 mt-0.5">{t('email_settings.enabled_desc', 'When disabled, no emails will be sent from the system')}</p>
            </div>
          </label>
        </div>
      </Card>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{testResult.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleTest}
          disabled={testing || !form.smtp_host || !form.smtp_user}
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {t('email_settings.test_connection', 'Test Connection')}
        </Button>
        <Button type="submit" loading={saving}>
          <CheckCircle2 size={16} />
          {t('email_settings.save_config', 'Save Configuration')}
        </Button>
      </div>
    </form>
  );
}
