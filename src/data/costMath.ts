/** Mirrors velora-api-v2 cost-math cone-demand formulas for live preview. */

export type CostLiveInputs = {
  coneWeightGrams: number
  conePrice: number
  yarnUsageGramsPerUnit: number
  quantity: number
  yarnColor?: string | null
  laborCost?: number
  electricityCost?: number
  packagingCost?: number
  otherCost?: number
  salePrice?: number | null
}

export type CostLiveResult = {
  yarnColor: string | null
  pricePerGram: number
  yarnUsageGramsPerUnit: number
  yarnCostPerUnit: number
  totalYarnGrams: number
  totalYarnKilograms: number
  exactConeRequirement: number
  requiredConeCount: number
  consumedYarnCost: number
  purchaseCost: number
  remainingYarnGrams: number
  extrasPerUnit: number
  totalCostPerUnit: number
  totalProductionCost: number
  suggestedSalePrice: number
  salePrice: number | null
  totalSaleAmount: number | null
  netProfit: number | null
  profitMarginPercent: number | null
  profitOptions: Array<{ marginPercent: number; salePrice: number }>
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function computeConeDemandLive(input: CostLiveInputs): CostLiveResult | null {
  const {
    coneWeightGrams,
    conePrice,
    yarnUsageGramsPerUnit,
    quantity,
    laborCost = 0,
    electricityCost = 0,
    packagingCost = 0,
    otherCost = 0,
  } = input

  if (
    ![coneWeightGrams, conePrice, yarnUsageGramsPerUnit, quantity, laborCost, electricityCost, packagingCost, otherCost].every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    ) ||
    coneWeightGrams <= 0 ||
    conePrice < 0 ||
    yarnUsageGramsPerUnit <= 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    laborCost < 0 ||
    electricityCost < 0 ||
    packagingCost < 0 ||
    otherCost < 0 ||
    (input.salePrice != null && (!Number.isFinite(input.salePrice) || input.salePrice < 0))
  ) {
    return null
  }

  const pricePerGramRaw = conePrice / coneWeightGrams
  const totalYarnGrams = quantity * yarnUsageGramsPerUnit
  const exactConeRequirement = totalYarnGrams / coneWeightGrams
  const requiredConeCount = Math.ceil(exactConeRequirement)
  const purchaseCostRaw = requiredConeCount * conePrice
  const remainingYarnGrams = requiredConeCount * coneWeightGrams - totalYarnGrams
  const yarnCostPerUnitRaw = yarnUsageGramsPerUnit * pricePerGramRaw
  const consumedYarnCostRaw = totalYarnGrams * pricePerGramRaw
  const extrasPerUnitRaw = laborCost + electricityCost + packagingCost + otherCost
  const totalCostPerUnitRaw = yarnCostPerUnitRaw + extrasPerUnitRaw
  const totalProductionCostRaw = quantity * totalCostPerUnitRaw
  const totalCostPerUnit = round(totalCostPerUnitRaw, 2)
  const suggestedSalePrice = round(totalCostPerUnit * 2, 2)
  const salePrice =
    input.salePrice == null || Number.isNaN(input.salePrice)
      ? null
      : round(input.salePrice, 2)

  let totalSaleAmount: number | null = null
  let netProfit: number | null = null
  let profitMarginPercent: number | null = null
  if (salePrice != null) {
    totalSaleAmount = round(quantity * salePrice, 2)
    netProfit = round(totalSaleAmount - round(totalProductionCostRaw, 2), 2)
    profitMarginPercent =
      totalSaleAmount > 0 ? round((netProfit / totalSaleAmount) * 100, 2) : 0
  }

  return {
    yarnColor: input.yarnColor?.trim() || null,
    pricePerGram: round(pricePerGramRaw, 4),
    yarnUsageGramsPerUnit,
    yarnCostPerUnit: round(yarnCostPerUnitRaw, 2),
    totalYarnGrams,
    totalYarnKilograms: round(totalYarnGrams / 1000, 4),
    exactConeRequirement: round(exactConeRequirement, 4),
    requiredConeCount,
    consumedYarnCost: round(consumedYarnCostRaw, 2),
    purchaseCost: round(purchaseCostRaw, 2),
    remainingYarnGrams: round(remainingYarnGrams, 4),
    extrasPerUnit: round(extrasPerUnitRaw, 2),
    totalCostPerUnit,
    totalProductionCost: round(totalProductionCostRaw, 2),
    suggestedSalePrice,
    salePrice,
    totalSaleAmount,
    netProfit,
    profitMarginPercent,
    profitOptions: [30, 50, 100, 200].map((marginPercent) => ({
      marginPercent,
      salePrice: round(totalCostPerUnit * (1 + marginPercent / 100), 2),
    })),
  }
}
