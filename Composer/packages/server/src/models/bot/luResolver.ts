// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FileInfo, ResolverResource } from '@bfc/shared';

import { Path } from '../../utility/path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const luObject = require('@microsoft/bf-lu/lib/parser/lu/lu.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const luOptions = require('@microsoft/bf-lu/lib/parser/lu/luOptions.js');

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}
function getBaseName(filename?: string): string | any {
  if (typeof filename !== 'string') return filename;
  return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

function isWildcardPattern(str: string): boolean {
  return str.endsWith('/*') || str.endsWith('/**');
}

function isURIContainsPath(str: string): boolean {
  return str.startsWith('/') || str.startsWith('./') || str.startsWith('../');
}

export function getLUFiles(files: FileInfo[]): FileInfo[] {
  return files.filter(({ name }) => name.endsWith('.lu'));
}

export function fileInfoToResources(files: FileInfo[]): ResolverResource[] {
  return files.map((file) => {
    return {
      id: getBaseName(file.name),
      content: file.content,
    };
  });
}

export function luImportResolverGenerator(files: FileInfo[]) {
  /**
   *  @param srcId current <file path> file id
   *  @param idsToFind imported <file path> file id
   *  for example:
   *  in todosample.en-us.lu:
   *   [help](help.lu)
   *
   *  would resolve to help.en-us.lu || help.lu
   *
   *  sourceId =  todosample.en-us.lu
   *  idsToFind =   [{ filePath: help.lu, includeInCollate: true}, ...]
   *
   *  Overlap implemented built-in fs resolver in
   *  botframework-cli/packages/lu/src/parser/lu/luMerger.js#findLuFilesInDir
   *  Not only by path, composer also support import by id and without locale
   */

  /**
   * common.lu#Help
   * common.lu#*utterances*
   * common.lu#*patterns*
   */
  const fragmentReg = new RegExp('#.*$');
  const ext = '.lu';
  // eslint-disable-next-line security/detect-non-literal-regexp
  const extReg = new RegExp(ext + '$');

  return (srcId: string, idsToFind: any[]) => {
    const sourceId = getFileName(srcId).replace(extReg, '');
    const locale = /\w\.\w/.test(sourceId) ? sourceId.split('.').pop() : 'en-us';

    const sourceFile =
      files.find(({ name }) => name === `${sourceId}.${locale}${ext}`) ||
      files.find(({ name }) => name === `${sourceId}${ext}`);

    if (!sourceFile) throw new Error(`File: ${srcId} not found`);

    const wildcardIds = idsToFind.filter((item) => isWildcardPattern(item.filePath));
    const fileIds = idsToFind.filter((item) => !isWildcardPattern(item.filePath));

    const luObjectFromWildCardIds = wildcardIds.reduce((prev, currValue) => {
      const luObjects = files.map((item) => {
        const options = new luOptions(item.path, currValue.includeInCollate, locale);
        return new luObject(item.content, options);
      });

      return prev.concat(luObjects);
    }, []);

    const luObjects = fileIds.map((file) => {
      const targetPath = file.filePath;
      const targetId = getFileName(targetPath).replace(fragmentReg, '').replace(extReg, '');

      let targetFile: FileInfo | undefined;
      if (isURIContainsPath(targetPath)) {
        // by path
        const targetFullPath = Path.resolve(sourceFile.path, targetPath.replace(fragmentReg, ''));
        const targetFullPath2 = Path.resolve(
          sourceFile.path,
          targetPath.replace(fragmentReg, '').replace(extReg, `.${locale}${ext}`)
        );
        targetFile =
          files.find(({ path }) => path === targetFullPath) || files.find(({ path }) => path === targetFullPath2);
      } else {
        // by id
        targetFile =
          files.find(({ name }) => name === `${targetId}.${locale}${ext}`) ||
          files.find(({ name }) => name === `${targetId}${ext}`);
      }

      if (!targetFile) throw new Error(`File: ${file.filePath} not found`);

      // lubuild use targetId index all luObjects, it should be uniq for each lu file.
      // absolute file path is an idea identifier.
      const options = new luOptions(targetFile.path, file.includeInCollate, locale);
      return new luObject(targetFile.content, options);
    });

    return luObjects.concat(luObjectFromWildCardIds);
  };
}
