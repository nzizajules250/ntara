import { useState } from 'react';
import { motion , AnimatePresence } from 'motion/react';
import { 
  Phone, Mail, MapPin, Clock, Send, MessageSquare, 
  HelpCircle, Shield, Star, ChevronRight, Loader2, 
  CheckCircle2, Headphones, LifeBuoy, FileText, 
  Smartphone, Globe, Users, Zap
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ContactPage() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const contactInfo = [
    {
      icon: Phone,
      title: 'Phone Support',
      details: ['+250 739 113 849', '+250 788 699 190'],
      description: 'Available for urgent matters',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50 dark:bg-green-500/10',
      iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600'
    },
    {
      icon: Mail,
      title: 'Email Support',
      details: ['nzizajules250@gmail.com', 'nzizadev@gmail.com'],
      description: 'We respond within 24 hours',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600'
    },
    {
      icon: MapPin,
      title: 'Office Location',
      details: ['Gisenyi, Rwanda', 'Buhuru'],
      description: 'Visit us during business hours',
      color: 'from-purple-500 to-indigo-600',
      bgColor: 'bg-purple-50 dark:bg-purple-500/10',
      iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600'
    },
    {
      icon: Clock,
      title: 'Business Hours',
      details: ['Mon - Fri: 8:00 AM - 8:00 PM', 'Sat - Sun: 9:00 AM - 6:00 PM'],
      description: 'Including public holidays',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-orange-50 dark:bg-orange-500/10',
      iconBg: 'bg-gradient-to-br from-orange-500 to-red-600'
    }
  ];

  const categories = [
    { value: 'general', label: 'General Inquiry', icon: HelpCircle },
    { value: 'support', label: 'Technical Support', icon: LifeBuoy },
    { value: 'billing', label: 'Billing & Payments', icon: FileText },
    { value: 'safety', label: 'Safety Concern', icon: Shield },
    { value: 'feedback', label: 'Feedback & Suggestions', icon: Star },
  ];

  const faqs = [
    {
      question: 'How do I request a ride?',
      answer: 'Open the app, set your pickup location and destination, choose your vehicle type, and tap "Request Now". A nearby driver will accept your ride.'
    },
    {
      question: 'How are fares calculated?',
      answer: 'Fares are negotiated directly between passengers and drivers. You can agree on a price before starting the trip.'
    },
    {
      question: 'Is my payment secure?',
      answer: 'Yes, all payments are processed securely. You can pay in cash or through mobile money services.'
    },
    {
      question: 'How do I become a driver?',
      answer: 'Register as a rider in the app, complete your profile with required documents (license, permit, vehicle details), and start accepting rides.'
    },
    {
      question: 'What safety features are available?',
      answer: 'We offer real-time GPS tracking, driver verification, emergency contacts, trip sharing, and 24/7 support.'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const currentUser = auth.currentUser;
      
      // Save to Firestore
      await addDoc(collection(db, 'contact_submissions'), {
        userId: currentUser?.uid || 'anonymous',
        userEmail: currentUser?.email || formData.email,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        category: formData.category,
        submittedAt: serverTimestamp(),
        status: 'new',
        read: false
      });

      setIsSubmitting(false);
      setIsSubmitted(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ name: '', email: '', phone: '', subject: '', message: '', category: 'general' });
      }, 3000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setIsSubmitting(false);
      alert('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] blur-2xl opacity-20" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/30">
              <Headphones className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-3">
            Get in Touch
          </h1>
          <p className="text-lg text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto font-semibold">
            We're here to help! Reach out to us through any of the channels below.
          </p>
        </motion.div>

        {/* Contact Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {contactInfo.map((info, index) => {
            const Icon = info.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ y: -4 }}
                className={`${info.bgColor} rounded-[2rem] p-6 border border-white/60 dark:border-white/10 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-lg transition-all duration-500`}
              >
                <div className={`w-12 h-12 ${info.iconBg} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-black text-gray-900 dark:text-white mb-2">{info.title}</h3>
                <div className="space-y-1 mb-3">
                  {info.details.map((detail, i) => (
                    <p key={i} className="text-sm text-gray-600 dark:text-zinc-300 font-semibold">{detail}</p>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">{info.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Contact Form & FAQ Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 dark:border-white/20 transition-all duration-500"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Send us a Message</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">We'll get back to you shortly</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isSubmitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center py-12 space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30"
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">Message Sent!</h3>
                  <p className="text-gray-500 dark:text-zinc-400 font-semibold">
                    Thank you for reaching out. We'll respond within 24 hours.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
                        placeholder="+250 788 000 000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all"
                      >
                        {categories.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
                      placeholder="How can we help?"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                      Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-zinc-800 py-3.5 px-5 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 outline-none font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all resize-none"
                      placeholder="Tell us more about your inquiry..."
                    />
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-purple-500/25 disabled:opacity-50 hover:from-purple-700 hover:to-indigo-700 transition-all"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Message
                      </>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 dark:border-white/20 transition-all duration-500"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Frequently Asked Questions</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">Quick answers to common questions</p>
              </div>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="bg-white/40 dark:bg-white/5 rounded-2xl p-5 hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 cursor-pointer group border border-transparent hover:border-white/40 dark:hover:border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {faq.question}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Still Need Help Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/5 dark:to-indigo-500/5 rounded-2xl p-6 border border-purple-100 dark:border-purple-500/20 text-center"
            >
              <LifeBuoy className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
              <h3 className="font-black text-gray-900 dark:text-white mb-1">Still need help?</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold mb-4">
                Our support team is available 24/7 to assist you.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/25"
              >
                <Headphones className="w-4 h-4" />
                Contact Support
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { icon: Users, label: 'Active Users', value: '10,000+', color: 'from-violet-500 to-purple-600' },
            { icon: Smartphone, label: 'App Downloads', value: '50,000+', color: 'from-cyan-500 to-blue-600' },
            { icon: Globe, label: 'Cities Covered', value: '15+', color: 'from-emerald-500 to-green-600' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -2 }}
              className="bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[2rem] p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 dark:border-white/20 text-center transition-all duration-500"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}