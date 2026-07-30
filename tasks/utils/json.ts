export function prettyStringifyObject(obj: any, uncut: boolean = false) {
  return JSON.stringify(
    obj,
    (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }

      if (!uncut && typeof value === "string" && value.length > 50) {
        return `${value.slice(0, 47)}...`;
      }

      return value;
    },
    2
  );
}
