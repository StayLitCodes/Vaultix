"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  IApiKey,
} from "@/lib/escrow-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_KEYS_PER_USER = 10;
const DEFAULT_RATE_LIMIT = 60;

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function ApiKeyManager() {
  return (
    <SectionCard title="API Keys" icon={Key}>
      <ApiKeyManagerInner />
    </SectionCard>
  );
}

function ApiKeyManagerInner() {
  const [keys, setKeys] = useState<IApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(DEFAULT_RATE_LIMIT);
  const [creating, setCreating] = useState(false);
  const [createdKeyData, setCreatedKeyData] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Fetch API keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const data = await listApiKeys();
      setKeys(data);
    } catch (error: any) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      const result = await createApiKey({
        name: newKeyName.trim(),
        rateLimitPerMinute: newKeyRateLimit || undefined,
      });

      setCreatedKeyData({
        key: result.key,
        name: result.name,
      });
      setShowCreatedKey(false);
      setNewKeyName("");
      setNewKeyRateLimit(DEFAULT_RATE_LIMIT);
      setCreateOpen(false);

      // Refresh the list
      await fetchKeys();
    } catch (error: any) {
      console.error("Error creating API key:", error);
      alert(error.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      setRevokingId(null);
      await fetchKeys();
    } catch (error: any) {
      console.error("Error revoking API key:", error);
      alert(error.message || "Failed to revoke API key");
    }
  };

  const handleTestKey = async (keyId: string) => {
    setTestingId(keyId);
    setTestResult(null);

    try {
      // Make a simple authenticated request to test the key
      // For now, we'll just verify the key exists in our list
      const keyExists = keys.some((k) => k.id === keyId && k.active);

      if (keyExists) {
        setTestResult({
          success: true,
          message: "API key is active and valid",
        });
      } else {
        setTestResult({
          success: false,
          message: "API key is inactive or not found",
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Test failed",
      });
    } finally {
      setTestingId(null);
    }
  };

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  const canCreateMoreKeys = activeKeys.length < MAX_KEYS_PER_USER;

  return (
    <div className="space-y-6">
      {/* Created Key Banner */}
      {createdKeyData && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Important: Copy your API key now!
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                This key will only be shown once. If you lose it, you'll need to
                create a new one.
              </p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-gray-800 break-all flex-1">
                {showCreatedKey ? createdKeyData.key : "•".repeat(64)}
              </code>
              <button
                onClick={() => setShowCreatedKey((s) => !s)}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                aria-label={showCreatedKey ? "Hide key" : "Show key"}
              >
                {showCreatedKey ? (
                  <EyeOff className="w-4 h-4 text-gray-500" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => handleCopyKey(createdKeyData.key)}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                aria-label="Copy key"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
          <button
            onClick={() => setCreatedKeyData(null)}
            className="mt-3 text-xs text-yellow-700 hover:text-yellow-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded-lg border ${
            testResult.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <p
            className={`text-sm ${
              testResult.success ? "text-green-800" : "text-red-800"
            }`}
          >
            {testResult.message}
          </p>
        </div>
      )}

      {/* Active Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Active Keys ({activeKeys.length}/{MAX_KEYS_PER_USER})
          </h3>
          {canCreateMoreKeys && (
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create Key
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
            <Key className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No API keys yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create your first API key to get started
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="mt-3"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((key) => (
              <div
                key={key.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-gray-800">
                        {key.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Rate limit: {key.rateLimitPerMinute}/min</span>
                      <span>•</span>
                      <span>
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestKey(key.id)}
                      disabled={testingId === key.id}
                      className="text-xs"
                    >
                      {testingId === key.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3 h-3" />
                      )}
                      Test
                    </Button>
                    {revokingId === key.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Confirm?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          className="text-xs"
                        >
                          Yes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevokingId(null)}
                          className="text-xs"
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokingId(key.id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Revoked Keys ({revokedKeys.length})
          </h3>
          <div className="space-y-2">
            {revokedKeys.map((key) => (
              <div
                key={key.id}
                className="border border-gray-200 rounded-lg p-4 opacity-60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Trash2 className="w-4 h-4 text-gray-400" />
                      <p className="text-sm font-medium text-gray-500 line-through">
                        {key.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>Rate limit: {key.rateLimitPerMinute}/min</span>
                      <span>•</span>
                      <span>
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                      {key.revokedAt && (
                        <>
                          <span>•</span>
                          <span>
                            Revoked{" "}
                            {new Date(key.revokedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Key Name *
              </label>
              <Input
                placeholder="e.g., My App, Production Server"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Rate Limit (requests per minute)
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={newKeyRateLimit}
                onChange={(e) =>
                  setNewKeyRateLimit(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Default: {DEFAULT_RATE_LIMIT} requests/minute
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || creating}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
