'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface FormData {
  partnerType: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
}

interface FormErrors {
  partnerType?: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export default function PartnerContactForm() {
  const t = useTranslations('partnering.contactForm');
  
  const [formData, setFormData] = useState<FormData>({
    partnerType: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.partnerType) {
      newErrors.partnerType = t('errors.partnerTypeRequired');
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = t('errors.companyNameRequired');
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = t('errors.contactNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('errors.emailInvalid');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('errors.phoneRequired');
    }

    if (!formData.message.trim()) {
      newErrors.message = t('errors.messageRequired');
    } else if (formData.message.trim().length < 10) {
      newErrors.message = t('errors.messageTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // For now, just log the form data
      // In production, this would send to a backend endpoint or email service
      console.log('Partner contact form submitted:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSubmitStatus('success');
      setFormData({
        partnerType: '',
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        message: '',
      });
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-xl text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} noValidate>
            {/* Partner Type Selection */}
            <div className="mb-6">
              <label htmlFor="partnerType" className="block text-sm font-semibold mb-2">
                {t('fields.partnerType.label')} <span className="text-red-500">*</span>
              </label>
              <select
                id="partnerType"
                name="partnerType"
                value={formData.partnerType}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.partnerType ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.partnerType}
                aria-describedby={errors.partnerType ? 'partnerType-error' : undefined}
              >
                <option value="">{t('fields.partnerType.placeholder')}</option>
                <option value="healthcare">{t('fields.partnerType.options.healthcare')}</option>
                <option value="ecommerce">{t('fields.partnerType.options.ecommerce')}</option>
                <option value="government">{t('fields.partnerType.options.government')}</option>
                <option value="advertiser">{t('fields.partnerType.options.advertiser')}</option>
                <option value="dataBuyer">{t('fields.partnerType.options.dataBuyer')}</option>
                <option value="other">{t('fields.partnerType.options.other')}</option>
              </select>
              {errors.partnerType && (
                <p id="partnerType-error" className="text-red-500 text-sm mt-1">
                  {errors.partnerType}
                </p>
              )}
            </div>

            {/* Company Name */}
            <div className="mb-6">
              <label htmlFor="companyName" className="block text-sm font-semibold mb-2">
                {t('fields.companyName.label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder={t('fields.companyName.placeholder')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.companyName ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.companyName}
                aria-describedby={errors.companyName ? 'companyName-error' : undefined}
              />
              {errors.companyName && (
                <p id="companyName-error" className="text-red-500 text-sm mt-1">
                  {errors.companyName}
                </p>
              )}
            </div>

            {/* Contact Name */}
            <div className="mb-6">
              <label htmlFor="contactName" className="block text-sm font-semibold mb-2">
                {t('fields.contactName.label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="contactName"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                placeholder={t('fields.contactName.placeholder')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.contactName ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.contactName}
                aria-describedby={errors.contactName ? 'contactName-error' : undefined}
              />
              {errors.contactName && (
                <p id="contactName-error" className="text-red-500 text-sm mt-1">
                  {errors.contactName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-semibold mb-2">
                {t('fields.email.label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t('fields.email.placeholder')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-red-500 text-sm mt-1">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="mb-6">
              <label htmlFor="phone" className="block text-sm font-semibold mb-2">
                {t('fields.phone.label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('fields.phone.placeholder')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
              />
              {errors.phone && (
                <p id="phone-error" className="text-red-500 text-sm mt-1">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Message */}
            <div className="mb-6">
              <label htmlFor="message" className="block text-sm font-semibold mb-2">
                {t('fields.message.label')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder={t('fields.message.placeholder')}
                rows={6}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.message ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? 'message-error' : undefined}
              />
              {errors.message && (
                <p id="message-error" className="text-red-500 text-sm mt-1">
                  {errors.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="mb-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('submitting') : t('submit')}
              </button>
            </div>

            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                {t('successMessage')}
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {t('errorMessage')}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
