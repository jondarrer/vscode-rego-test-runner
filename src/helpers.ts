import {
  FindFilesFunc,
  ICancellationToken,
  IGlobPattern,
  ITestController,
  ITestItem,
  ITestRunRequest,
  ITextDocument,
  IUri,
} from './types';

export const handleRunRequest = (
  controller: ITestController,
  request: ITestRunRequest,
  cancellation: ICancellationToken
) => {};

export const updateWorkspaceTestFile = (controller: ITestController, document: ITextDocument) => {};

export const registerTestItemFile = (controller: ITestController, uri: IUri): ITestItem => {
  const existing = controller.items.get(uri.toString());
  if (existing) {
    return existing;
  }

  const item = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
  controller.items.add(item);
  return item;
};

export const refreshTestFiles = async (
  controller: ITestController,
  pattern: IGlobPattern,
  findFiles: FindFilesFunc
) => {};
