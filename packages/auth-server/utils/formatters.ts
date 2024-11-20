import { formatUnits } from "viem";

export const shortenAddress = (address: string, chars = 3): string => {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const formatAmount = (
  amount: bigint,
  decimals: number,
  maxPrecision: number = 4,
): string => {
  const formattedAmount = formatUnits(amount, decimals);

  // Check if the number is less than the minimum precision threshold
  if (parseFloat(formattedAmount) < Math.pow(10, -maxPrecision)) {
    return `<${Math.pow(10, -maxPrecision).toFixed(maxPrecision)}`;
  }

  // Find the position of the decimal point
  const decimalPointIndex = formattedAmount.indexOf(".");

  // If there is no decimal point, return the number as is
  if (decimalPointIndex === -1) {
    return formattedAmount;
  }

  // Split the number into integer and fractional parts
  const integerPart = formattedAmount.slice(0, decimalPointIndex);
  const fractionalPart = formattedAmount.slice(decimalPointIndex + 1);

  // Round the fractional part to the specified precision
  let roundedFractionalPart = fractionalPart.slice(0, maxPrecision);
  if (fractionalPart.length > maxPrecision) {
    const nextDigit = parseInt(fractionalPart[maxPrecision], 10);
    if (nextDigit >= 5) {
      roundedFractionalPart = (parseInt(roundedFractionalPart, 10) + 1).toString().padStart(maxPrecision, "0");
    }
  }

  // Remove trailing zeros from the fractional part
  roundedFractionalPart = roundedFractionalPart.replace(/0+$/, "");

  // Combine the integer part and the rounded fractional part
  if (roundedFractionalPart === "") {
    return integerPart;
  } else {
    return `${integerPart}.${roundedFractionalPart}`;
  }
};

export const formatPricePretty = (price: number): string => {
  if (!price) {
    return "$0";
  } else if (price < 0.01) {
    return "<$0.01";
  }
  const precision = 2;
  const rounded = price.toFixed(precision);
  if (rounded.endsWith(`.${"0".repeat(precision)}`)) {
    return "$" + price.toFixed(0);
  }
  return "$" + price.toFixed(2);
};

export const formatTokenPrice = (amount: bigint, decimals: number, price: number): string => {
  const formattedTokenAmount = formatUnits(amount, decimals);
  return formatPricePretty(parseFloat(formattedTokenAmount) * price);
};
