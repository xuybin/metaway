import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import { dirname, join, relative, resolve } from "std/path/mod.ts";
import { mergeReadableStreams } from "std/streams/mod.ts";

export interface Data {
  cli: string; // https://deno.land/x/aleph@1.0.0-beta.19/init.ts
  template: string; // [react, vue, api, solid, yew]
  projectDir: string;
  fileMerge: "skip" | "replace";
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
    projectDir: {
      type: "string",
      pattern: '^(?:\\./|\\.\\./)+(?:[A-Za-z0-9_.-]+/)*(?:[^\\\\/:*?"<>| .]?)$',
      default: "./",
    },
    fileMerge: {
      type: "string",
      enum: ["skip", "replace"],
      default: "skip",
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
    projectDir: "./",
    fileMerge: "skip",
    genRouteExport: true,
    useUnocss: false,
    useVSCode: true,
  },
};

export async function exportSchemaDefault(ajv: Ajv, path: string) {
  const fullPath = join(Deno.cwd(), path);
  await Deno.mkdir(dirname(fullPath), { recursive: true });
  const validate = ajv.getSchema<Data>(schema.$id) as ValidateFunction ||
    ajv.compile(schema);
  const schemaDefault = {};
  if (validate(schemaDefault)) {
    await Deno.writeTextFile(fullPath, JSON.stringify(schemaDefault, null, 2));
    return true;
  } else {
    console.error(`"${schema.$id}" not default profiles:`, validate.errors);
    return false;
  }
}

async function copyDir(srcDir: string, destDir: string, overwrite = false) {
  for await (const dirEntry of Deno.readDir(srcDir)) {
    const src = join(srcDir, dirEntry.name);
    const dest = join(destDir, dirEntry.name);
    if (dirEntry.isFile) {
      if (overwrite) {
        await Deno.copyFile(src, dest);
      } else {
        try {
          await Deno.lstat(dest);
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) {
            await Deno.copyFile(src, dest);
          } else {
            throw error;
          }
        }
      }
    } else if (dirEntry.isDirectory) {
      try {
        await Deno.mkdir(join(destDir, dirEntry.name));
      } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
          throw error;
        }
      }
      await copyDir(src, dest, overwrite);
    } else {
      console.warn(dirEntry.name + " isSymlink skip.");
    }
  }
}

export async function init(ajv: Ajv, profilesPath: string) {
  const fullProfilesPath = join(Deno.cwd(), profilesPath);
  const validate = ajv.getSchema<Data>(schema.$id) as ValidateFunction || ajv.compile(schema);
  try {
    const profiles = JSON.parse(await Deno.readTextFile(fullProfilesPath)) as Data;
    if (validate(profiles)) {
      const fullProjectDir = resolve(dirname(fullProfilesPath), profiles.projectDir);
      const tempDir = await Deno.makeTempDir({ prefix: "alephjs_project" });
      const cwdOld = Deno.cwd();
      Deno.chdir(dirname(tempDir));
      const child = Deno.spawnChild(Deno.execPath(), {
        args: ["run", "-A", profiles.cli, `--template=${profiles.template}`, relative(Deno.cwd(), tempDir)],
        stderr: "piped",
        stdin: "piped",
      });

      const reader = mergeReadableStreams(child.stdout, child.stderr).pipeThrough(new TextDecoderStream()).getReader();
      const writer = child.stdin.getWriter();
      let noError = true;
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        let command = "N";
        if (value.includes("already exists")) {
          command = "Y";
          await writer.write(new TextEncoder().encode(command));
          console.log(`${value} ${command}`);
        } else if (value.includes("Generate `_export.ts`")) {
          command = profiles.genRouteExport ? "Y" : "N";
          await writer.write(new TextEncoder().encode(command));
          console.log(`${value} ${command}`);
        } else if (value.includes("Using Unocss")) {
          command = profiles.useUnocss ? "Y" : "N";
          await writer.write(new TextEncoder().encode(command));
          console.log(`${value} ${command}`);
        } else if (value.includes("Initialize VS Code workspace configuration")) {
          command = profiles.useVSCode ? "Y" : "N";
          await writer.write(new TextEncoder().encode(command));
          console.log(`${value} ${command}`);
        } else {
          if (value.includes("error")) {
            noError = false;
          }
          console.log(`${value}`);
        }
      }
      Deno.chdir(cwdOld);
      if (noError) {
        await copyDir(tempDir, fullProjectDir, profiles.fileMerge == "replace");
      }
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }

      return noError;
    } else {
      if (validate.errors) {
        console.error(`"${fullProfilesPath}" validate failed:`, validate.errors);
      } else {
        console.error(`"${fullProfilesPath}" validate failed.`);
      }
    }
  } catch (_error) {
    console.error(`"${fullProfilesPath}" is not a valid json.`);
  }
  return false;
}
