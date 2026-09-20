import { parse as parseYaml } from "yaml";
import type { Contract, ContractProperty, ContractSchema, LogicalType } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map((item) => (typeof item === "string" ? item : String(item)));
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return undefined;
}

function buildProperty(raw: Record<string, unknown>): ContractProperty {
  const name = raw["name"];
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("not a data contract: a property is missing a name");
  }

  const logicalTypeRaw = raw["logicalType"] ?? raw["type"];
  const property: ContractProperty = {
    name,
    logicalType: (typeof logicalTypeRaw === "string" ? logicalTypeRaw : "") as LogicalType,
    required: toBoolean(raw["required"]),
    unique: toBoolean(raw["unique"]),
  };

  const enumValues = toStringArray(raw["enum"]);
  if (enumValues !== undefined) {
    property.enum = enumValues;
  }
  if (typeof raw["pattern"] === "string") {
    property.pattern = raw["pattern"];
  }
  if (typeof raw["format"] === "string") {
    property.format = raw["format"];
  }
  const minimum = toNumber(raw["minimum"]);
  if (minimum !== undefined) {
    property.minimum = minimum;
  }
  const maximum = toNumber(raw["maximum"]);
  if (maximum !== undefined) {
    property.maximum = maximum;
  }
  if (typeof raw["description"] === "string") {
    property.description = raw["description"];
  }

  return property;
}

export function parseContract(text: string): Contract {
  let document: unknown;
  try {
    document = parseYaml(text);
  } catch (error) {
    throw new Error(`not a data contract: could not parse input (${messageOf(error)})`);
  }

  if (!isRecord(document)) {
    throw new Error("not a data contract: expected a mapping at the top level");
  }

  const schemaRaw = document["schema"];
  if (!Array.isArray(schemaRaw)) {
    throw new Error("not a data contract: `schema` is missing or not an array");
  }

  const schema: ContractSchema[] = [];
  for (const entryRaw of schemaRaw) {
    if (!isRecord(entryRaw)) {
      schema.push({
        name: "",
        logicalType: "",
        properties: undefined as unknown as ContractProperty[],
      });
      continue;
    }

    const propertiesRaw = entryRaw["properties"];
    let properties: ContractProperty[];
    if (Array.isArray(propertiesRaw)) {
      properties = propertiesRaw.map((propertyRaw) => {
        if (!isRecord(propertyRaw)) {
          throw new Error("not a data contract: a property is missing a name");
        }
        return buildProperty(propertyRaw);
      });
    } else {
      properties = undefined as unknown as ContractProperty[];
    }

    schema.push({
      name: typeof entryRaw["name"] === "string" ? entryRaw["name"] : "",
      logicalType: typeof entryRaw["logicalType"] === "string" ? entryRaw["logicalType"] : "",
      properties,
    });
  }

  const contract: Contract = { schema };
  if (typeof document["apiVersion"] === "string") {
    contract.apiVersion = document["apiVersion"];
  }
  if (typeof document["kind"] === "string") {
    contract.kind = document["kind"];
  }
  if (typeof document["id"] === "string") {
    contract.id = document["id"];
  }
  if (typeof document["name"] === "string") {
    contract.name = document["name"];
  }
  if (typeof document["status"] === "string") {
    contract.status = document["status"];
  }

  return contract;
}
