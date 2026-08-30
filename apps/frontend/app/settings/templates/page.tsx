'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  Briefcase,
  ShoppingCart,
  Handshake,
  Settings,
} from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { EscrowTemplate } from '@/lib/templates';
import { useToast } from '@/hooks/useToast';

const iconMap: Record<string, React.ElementType> = {
  Briefcase,
  ShoppingCart,
  Handshake,
  Settings,
};

export default function TemplatesSettingsPage() {
  const { customTemplates, updateCustomTemplate, deleteCustomTemplate } = useTemplates();
  const { success } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleEdit = (template: EscrowTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditDescription(template.description || '');
  };

  const handleSaveEdit = (id: string) => {
    updateCustomTemplate(id, { name: editName, description: editDescription });
    success('Template updated successfully!');
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteCustomTemplate(id);
      success('Template deleted successfully!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Templates</h1>
            <p className="text-gray-500 text-sm">Create, edit, and delete your custom escrow templates</p>
          </div>
        </div>

        {customTemplates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Custom Templates Yet</h2>
            <p className="text-gray-500 mb-6">
              Save your first template by creating an escrow and selecting "Save as Template"
            </p>
            <Link
              href="/escrow/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Escrow
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {customTemplates.map(template => {
              const Icon = template.icon ? iconMap[template.icon] || Settings : Settings;
              const isEditing = editingId === template.id;

              return (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(template.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                          )}
                          {template.data.milestones && template.data.milestones.length > 0 && (
                            <p className="text-xs text-gray-400 mt-2">
                              {template.data.milestones.length} milestone{template.data.milestones.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
