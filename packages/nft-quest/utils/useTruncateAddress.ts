export const useTruncateAddress = (address: `0x${string}`) => {
  if (!address) return null;

  const match = address.match(
    /^(0x[a-zA-Z0-9]{2})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/,
  );
  if (!match) return address;
  return `${match[1]}…${match[2]}`;
};
