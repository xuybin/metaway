import Ajv, {
  JSONSchemaType,
  ValidateFunction,
} from "https://esm.sh/v95/ajv@8.11.0";
import addFormats from "https://esm.sh/v95/ajv-formats@2.1.1";
import { parse } from "https://deno.land/std@0.155.0/flags/mod.ts";
import { join } from "https://deno.land/std@0.155.0/path/mod.ts";
export interface Data {
  cli: string; // https://deno.land/x/aleph@1.0.0-beta.19/init.ts
  template: string; // [react, vue, api, solid, yew]
  projectName: string;
  genRouteExport: boolean;
  useUnocss: boolean;
  useVSCode: boolean;
}

export const schema: JSONSchemaType<Data> & { "$id": string } = {
  $id: "alephjs/init",
  title: "Alephjs Init Options",
  description: "Alephjs项目初始化所需的选项",
  type: "object",
  additionalProperties: false,
  required: [],
  definitions: {},
  properties: {
    cli: {
      type: "string",
      pattern:
        "^https://deno.land/x/aleph(?:@(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?)?/init.ts$",
      default: "https://deno.land/x/aleph/init.ts",
    },
    template: {
      type: "string",
      enum: ["react", "react-mdx", "vue", "api", "solid", "yew"],
      default: "react",
    },
    projectName: {
      type: "string",
      pattern: '^(?:./|../)+(?:[^\\\\/:*?"<>| ]+)$',
      default: "./alephjs.default.json",
    },
    genRouteExport: {
      type: "boolean",
      default: true,
    },
    useUnocss: {
      type: "boolean",
      default: false,
    },
    useVSCode: {
      type: "boolean",
      default: true,
    },
  },
  default: {
    cli: "https://deno.land/x/aleph/init.ts",
    projectName: "./alephjs.default.json",
    genRouteExport: true,
    useUnocss: false,
    useVSCode: true,
  },
};

export async function exportSchemaDefault(ajv: Ajv, path: string) {
  const fullPath = join(Deno.cwd(), path);
  const validate = ajv.getSchema<Data>(schema.$id) as ValidateFunction ||
    ajv.compile(schema);
  const schemaDefault = {};
  if (validate(schemaDefault)) {
    await Deno.writeTextFile(fullPath, JSON.stringify(schemaDefault, null, 2));
  } else {
    console.error(
      `${schema.$id} schema not default value: ${
        JSON.stringify(validate.errors)
      }.`,
    );
  }
}
