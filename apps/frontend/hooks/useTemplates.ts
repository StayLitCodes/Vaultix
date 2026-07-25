'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  EscrowTemplate,
  BUILT_IN_TEMPLATES,
  escrowTemplateSchema,
} from '@/lib/templates';

const CUSTOM_TEMPLATES_KEY = 'vaultix-escrow-templates';
const RECENT_TEMPLATES_KEY = 'vaultix-recent-templates';

export function useTemplates() {
  const [customTemplates, setCustomTemplates] = useState<EscrowTemplate[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const loadTemplates = () => {
      try {
        const savedCustom = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
        const savedRecent = localStorage.getItem(RECENT_TEMPLATES_KEY);

        if (savedCustom) {
          const parsed = JSON.parse(savedCustom);
          if (Array.isArray(parsed)) {
            const validated = parsed
              .map(t => escrowTemplateSchema.safeParse(t))
              .filter((r): r is { success: true; data: EscrowTemplate } => r.success)
              .map(r => r.data);
            setCustomTemplates(validated);
          }
        }

        if (savedRecent) {
          const parsed = JSON.parse(savedRecent);
          if (Array.isArray(parsed)) {
            setRecentTemplates(parsed.slice(0, 3));
          }
        }
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    };

    loadTemplates();
  }, []);

  // Save custom templates to localStorage
  const saveCustomTemplates = useCallback((templates: EscrowTemplate[]) => {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
    setCustomTemplates(templates);
  }, []);

  // Save recent templates to localStorage
  const saveRecentTemplates = useCallback((templateIds: string[]) => {
    const trimmed = templateIds.slice(0, 3);
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(trimmed));
    setRecentTemplates(trimmed);
  }, []);

  // Add a custom template
  const addCustomTemplate = useCallback((template: Omit<EscrowTemplate, 'id' | 'isBuiltIn'>) => {
    const newTemplate: EscrowTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      isBuiltIn: false,
    };
    const updated = [...customTemplates, newTemplate];
    saveCustomTemplates(updated);
    return newTemplate;
  }, [customTemplates, saveCustomTemplates]);

  // Update a custom template
  const updateCustomTemplate = useCallback((id: string, updates: Partial<Omit<EscrowTemplate, 'id' | 'isBuiltIn'>>) => {
    const updated = customTemplates.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    saveCustomTemplates(updated);
  }, [customTemplates, saveCustomTemplates]);

  // Delete a custom template
  const deleteCustomTemplate = useCallback((id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    saveCustomTemplates(updated);
  }, [customTemplates, saveCustomTemplates]);

  // Mark a template as recently used
  const markAsRecentlyUsed = useCallback((templateId: string) => {
    const updatedRecent = [templateId, ...recentTemplates.filter(id => id !== templateId)];
    saveRecentTemplates(updatedRecent);
  }, [recentTemplates, saveRecentTemplates]);

  // Get all templates (built-in + custom)
  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];

  // Get recent templates
  const recentTemplatesList = recentTemplates
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is EscrowTemplate => t !== undefined);

  return {
    customTemplates,
    recentTemplates: recentTemplatesList,
    allTemplates,
    addCustomTemplate,
    updateCustomTemplate,
    deleteCustomTemplate,
    markAsRecentlyUsed,
  };
}
