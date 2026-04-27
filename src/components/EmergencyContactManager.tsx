import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Edit2, Save, X, AlertCircle, CheckCircle2, Heart, Loader2 } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNotifications } from './NotificationCenter';

interface EmergencyContactManagerProps {
  userId: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  onUpdate?: (contact: { name: string; phone: string }) => void;
}

export default function EmergencyContactManager({
  userId,
  emergencyContact,
  onUpdate,
}: EmergencyContactManagerProps) {
  const { addNotification } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: emergencyContact?.name || '',
    phone: emergencyContact?.phone || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s|-/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const contact = {
        name: formData.name.trim(),
        phone: formData.phone.replace(/\s|-/g, ''),
      };

      await updateDoc(doc(db, 'users', userId), {
        emergencyContact: contact,
      });

      if (onUpdate) {
        onUpdate(contact);
      }

      setIsEditing(false);
      addNotification('Emergency Contact Saved', `${contact.name} will receive ride alerts`, 'success');
    } catch (error) {
      console.error('Error saving emergency contact:', error);
      addNotification('Error', 'Failed to save emergency contact', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: emergencyContact?.name || '',
      phone: emergencyContact?.phone || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-zinc-800"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Emergency Contact</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">Notified when you start a ride</p>
          </div>
        </div>

        {!isEditing && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsEditing(true)}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <Edit2 className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Name Field */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="e.g., Mom, Sister, Brother"
                className={`w-full bg-gray-50 dark:bg-zinc-800 py-3 px-4 rounded-xl border-2 outline-none font-semibold text-sm transition-all ${
                  errors.name
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-transparent focus:border-red-500 dark:focus:border-red-400'
                } text-gray-900 dark:text-white placeholder:text-gray-400`}
              />
              {errors.name && (
                <p className="text-xs text-red-500 font-semibold mt-1 px-1">{errors.name}</p>
              )}
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                placeholder="+250 788 000 000"
                className={`w-full bg-gray-50 dark:bg-zinc-800 py-3 px-4 rounded-xl border-2 outline-none font-semibold text-sm transition-all ${
                  errors.phone
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-transparent focus:border-red-500 dark:focus:border-red-400'
                } text-gray-900 dark:text-white placeholder:text-gray-400`}
              />
              {errors.phone && (
                <p className="text-xs text-red-500 font-semibold mt-1 px-1">{errors.phone}</p>
              )}
            </div>

            {/* Info Alert */}
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-red-900 dark:text-red-200 mb-1">Emergency Alert</p>
                <p className="text-xs text-red-700 dark:text-red-300 font-semibold">
                  This contact will receive an SMS with your pickup location, destination, and driver details when you start a ride.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 disabled:opacity-50 hover:from-red-600 hover:to-pink-700 transition-all"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Contact
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
              >
                <X className="w-5 h-5" />
                Cancel
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {emergencyContact ? (
              <>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Name
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {emergencyContact.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Phone
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {emergencyContact.phone}
                    </p>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700 dark:text-green-300 font-semibold">
                    Your emergency contact is set and will receive ride alerts.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  No emergency contact set. Click edit to add one.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
