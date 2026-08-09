type options = {
  uncut: boolean;
  tabs: number;
};

export function prettyStringifyObject(
  obj: any,
  options: options = { tabs: 1, uncut: false }
) {
  const indent = "\t".repeat(options.tabs);

  const jsonString = JSON.stringify(
    obj,
    (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }

      if (!options.uncut && typeof value === "string" && value.length > 50) {
        return `${value.slice(0, 47)}...`;
      }

      return value;
    },
    2
  );
  return jsonString.replace(/^/gm, indent);
}
