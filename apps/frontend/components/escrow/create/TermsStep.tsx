"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { CreateEscrowFormData } from "@/lib/escrow-schema";
import { Input } from "@/components/ui/input";
import AssetSelector from "@/components/stellar/AssetSelector";
import { AssetService, IAllowedAsset } from "@/services/assets";

export default function TermsStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateEscrowFormData>();

  const selectedAssetCode = watch("asset") || "XLM";
  const amountValue = watch("amount") || "0";

  const [selectedAsset, setSelectedAsset] = useState<IAllowedAsset | null>(null);

  // Load the active asset matching the selected code
  useEffect(() => {
    let active = true;
    AssetService.getActiveAssets().then((list) => {
      if (!active) return;
      const match = list.find((a) => a.code === selectedAssetCode) || list.find((a) => a.code === "XLM") || null;
      setSelectedAsset(match);
    });
    return () => {
      active = false;
    };
  }, [selectedAssetCode]);

  const handleSelectAsset = (asset: IAllowedAsset) => {
    setSelectedAsset(asset);
    setValue("asset", asset.code);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Escrow Terms</h2>
        <p className="text-sm text-gray-500">
          Define the financial terms and deadlines for this agreement.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          {/* Amount Field */}
          <div className="relative">
            <Input
              label="Amount"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register("amount")}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-6 pointer-events-none">
              <span className="text-gray-500 sm:text-sm font-semibold">{selectedAssetCode}</span>
            </div>
          </div>

          {/* Asset Selector */}
          <AssetSelector
            selectedAsset={selectedAsset}
            onSelectAsset={handleSelectAsset}
            amount={amountValue}
          />
        </div>

        {/* Deadline Field */}
        <Input
          label="Deadline"
          type="datetime-local"
          helperText="The date and time by which the terms must be met."
          error={errors.deadline?.message}
          {...register("deadline", { valueAsDate: true })}
        />
      </div>
    </div>
  );
}
