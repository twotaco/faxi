'use client';

import { useState } from 'react';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';

interface FooterContactFormProps {
  locale: string;
}

export function FooterContactForm({ locale }: FooterContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const t = {
    en: {
      title: 'Send us a message',
      name: 'Name',
      email: 'Email',
      message: 'Message',
      submit: 'Send',
      submitting: 'Sending...',
      success: 'Message sent!',
      error: 'Failed to send. Please try again.',
    },
    ja: {
      title: 'お問い合わせ',
      name: 'お名前',
      email: 'メール',
      message: 'メッセージ',
      submit: '送信',
      submitting: '送信中...',
      success: '送信しました',
      error: '送信に失敗しました',
    },
  };

  const text = locale === 'ja' ? t.ja : t.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/contact/simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          source: 'footer',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitStatus('success');
      setFormData({ name: '', email: '', message: '' });

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="mt-6">
      <h5 className="text-sm font-semibold text-white/80 mb-3">{text.title}</h5>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={text.name}
          required
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-faxi-brown-light focus:border-transparent"
        />
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder={text.email}
          required
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-faxi-brown-light focus:border-transparent"
        />
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder={text.message}
          required
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-faxi-brown-light focus:border-transparent resize-none"
        />
        <button
          type="submit"
          disabled={isSubmitting || submitStatus === 'success'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-faxi-brown hover:bg-faxi-brown-light text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitStatus === 'success' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              {text.success}
            </>
          ) : submitStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              {text.error}
            </>
          ) : isSubmitting ? (
            text.submitting
          ) : (
            <>
              <Send className="w-4 h-4" />
              {text.submit}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
