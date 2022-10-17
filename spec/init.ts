import Ajv, { AsyncValidateFunction, FuncKeywordDefinition, JSONSchemaType } from "https://esm.sh/v95/ajv@8.11.0";
import { parse } from "https://deno.land/std@0.155.0/flags/mod.ts";

// 输出默认配置JSON --export  **/*.json
// 修改配置JSON
// 以指定配置JSON,执行 命令  --import=**/*.json outputDir
// 参数冒泡到上层作为选项,目录以当前 模板 相对目录 为准
export interface Data {
  export?: boolean;
  template: string;
  _: string[];
}

const existsFile: FuncKeywordDefinition = {
  keyword: "existsFile",
  async: true,
  type: "string",
  schemaType: "boolean",
  validate: async (schema: boolean, data: string) => {
    try {
      const stat = await Deno.lstat(data);
      return schema ? stat.isFile : false; // 当要求文件不存在时,存在相同目录,也为false
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return schema ? false : true; // 当要求文件不存在时,恒为true
      }
      throw err;
    }
  },
};

const existsDir: FuncKeywordDefinition = {
  keyword: "existsDir",
  async: true,
  type: "string",
  schemaType: "boolean",
  validate: async (schema: boolean, data: string) => {
    try {
      const stat = await Deno.lstat(data);
      return schema ? stat.isDirectory : false; // 当要求目录不存在时,存在相同文件,也为false
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return schema ? false : true; // 当要求目录不存在时,恒为true
      }
      throw err;
    }
  },
};

const existsTemplate: FuncKeywordDefinition = {
  keyword: "existsTemplate",
  async: true,
  type: "string",
  validate: async (_schema: any, data: string) => {
    try {
      const templateInit = import.meta.resolve(`./${data}/mod.ts`);
      const { status } = await fetch(templateInit);
      return status == 200;
    } catch (_err) {
      // TypeError   NetworkError when attempting to fetch resource.
      return false;
    }
  },
};

export const schema: JSONSchemaType<Data> & { "$id": string; $async: true } = {
  $id: "init",
  title: "Project Init",
  description: "项目初始化",
  $async: true,
  type: "object",
  required: [],
  definitions: {},
  anyOf: [
    {
      required: ["export", "template", "_"],
      additionalProperties: false,
      properties: {
        export: {
          const: true,
        },
        template: {
          type: "string",
          existsTemplate,
        },
        _: {
          type: "array",
          minItems: 1,
          maxItems: 1,
          items: {
            type: "string",
            pattern: '^(?:\\./|\\.\\./)+(?:[A-Za-z0-9_.-]+/)*(?:[^\\\\/:*?"<>| ]+)$',
            existsFile: false,
          },
        },
      },
    },
    {
      required: ["template", "_"],
      additionalProperties: false,
      properties: {
        export: {
          const: false,
        },
        template: {
          type: "string",
          existsTemplate,
        },
        _: {
          type: "array",
          minItems: 1,
          maxItems: 1,
          items: {
            type: "string",
            pattern: '^(?:\\./|\\.\\./)+(?:[A-Za-z0-9_.-]+/)*(?:[^\\\\/:*?"<>| ]+)$',
            existsFile: true,
          },
        },
      },
    },
  ],
};

if (import.meta.main) {
  // 输出默认配置JSON
  // 修改配置JSON
  // 以指定配置JSON,执行
  //import.meta.resolve("../.env.example")
  const flags = parse(Deno.args, {
    boolean: ["export"],
    string: ["template"],
  });

  //console.log(`flags:${JSON.stringify(flags)} `);

  const ajv = new Ajv({ useDefaults: true, strictSchema: false });
  ajv.addKeyword(existsFile);
  ajv.addKeyword(existsDir);
  ajv.addKeyword(existsTemplate);

  const validate = (ajv.getSchema<Data>(schema.$id) as
    | AsyncValidateFunction<Data>
    | undefined) || ajv.compile(schema) as AsyncValidateFunction<Data>;
  try {
    const data = await validate(flags);
    const { exportSchemaDefault, init } = await import(
      import.meta.resolve(`./${data.template}/mod.ts`)
    ) as {
      exportSchemaDefault: (ajv: Ajv, path: string) => Promise<boolean>;
      init: (ajv: Ajv, profilesPath: string) => Promise<boolean>;
    };
    if (data.export) {
      if (await exportSchemaDefault(ajv, data._[0])) {
        console.log(`export "${data.template}" template default profiles into "${data._[0]}".`);
      }
    } else {
      if (await init(ajv, data._[0])) {
        console.log(`project initialized with "${data.template}" template and "${data._[0]}" profiles.`);
      }
    }
  } catch (err) {
    if (err instanceof Ajv.ValidationError) {
      //console.log(err.errors);
      let message = "";
      for (const iterator of err.errors) {
        if (iterator.instancePath && iterator.instancePath != "/export") {
          message = `"${iterator.instancePath?.replace("/", "")}" ${iterator.message}`;
          break;
        }
      }
      if (message == "") {
        console.log(`export  profiles   example: --template=alephjs --export ./alephjsProject/metaway.json`);
        console.log(`project initialize example: --template=alephjs ./alephjsProject/metaway.json\n`);
        for (const iterator of err.errors) {
          if (iterator.instancePath != "/export") {
            message = `"${iterator.instancePath?.replace("/", "")}" ${iterator.message}`;
            break;
          }
        }
      }
      console.log(`input: ${JSON.stringify(flags)}`);
      console.log(`error: ${message}`);
    } else {
      throw err;
    }
  }
}
