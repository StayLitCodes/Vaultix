'use client';

import React from 'react';
import {
  Briefcase,
  ShoppingCart,
  Handshake,
  Settings,
  Clock,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { EscrowTemplate, templateToFormData } from '@/lib/templates';
import { CreateEscrowFormData } from '@/lib/escrow-schema';

const iconMap: Record<string, React.ElementType> = {
  Briefcase,
  ShoppingCart,
  Handshake,
  Settings,
};

interface TemplateCardProps {
  template: EscrowTemplate;
  isSelected: boolean;
  onClick: () => void;
  isRecent?: boolean;
}

function TemplateCard({ template, isSelected, onClick, isRecent }: TemplateCardProps) {
  const Icon = template.icon ? iconMap[template.icon] || Settings : Settings;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
        isSelected
          ? 'border-blue-600 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 p-2 rounded-lg ${
            isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
            {isRecent && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            {template.isBuiltIn && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Built-in
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
          {template.data.milestones && template.data.milestones.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{template.data.milestones.length} milestone{template.data.milestones.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {isSelected && (
          <div className="flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
        )}
      </div>
    </button>
  );
}

interface TemplateSelectorProps {
  onSelect: (formData: Partial<CreateEscrowFormData>) => void;
  selectedTemplateId?: string;
}

export default function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
  const { allTemplates, recentTemplates, markAsRecentlyUsed } = useTemplates();
  const [selectedId, setSelectedId] = React.useState<string | undefined>(selectedTemplateId);

  const handleSelect = (template: EscrowTemplate) => {
    setSelectedId(template.id);
    markAsRecentlyUsed(template.id);
    onSelect(templateToFormData(template));
  };

  const customTemplates = allTemplates.filter(t => !t.isBuiltIn);
  const builtInTemplates = allTemplates.filter(t => t.isBuiltIn);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a Template</h2>
        <p className="text-gray-500 text-sm mb-6">
          Select a template to pre-fill your escrow configuration, or start from scratch.
        </p>
      </div>

      {recentTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-yellow-500" />
            <h3 className="font-medium text-gray-800">Recently Used</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                onClick={() => handleSelect(template)}
                isRecent
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-medium text-gray-800 mb-3">Built-in Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtInTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedId === template.id}
              onClick={() => handleSelect(template)}
            />
          ))}
        </div>
      </div>

      {customTemplates.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-800 mb-3">Custom Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                onClick={() => handleSelect(template)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
