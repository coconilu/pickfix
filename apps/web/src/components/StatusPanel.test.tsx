// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusPanel } from "./StatusPanel";
import { getGitStatus, revertGitFile, type GitStatus } from "@/lib/git";

vi.mock("@/lib/git", () => ({
  getGitStatus: vi.fn(),
  revertGitFile: vi.fn(),
}));

const getGitStatusMock = vi.mocked(getGitStatus);
const revertGitFileMock = vi.mocked(revertGitFile);

function gitStatus(paths: string[]): GitStatus {
  return {
    repositoryStatus: "own",
    isGitRepo: true,
    branch: "main",
    baseBranch: null,
    changedFiles: paths,
    added: [],
    modified: paths,
    deleted: [],
    fileChanges: paths.map((filePath) => ({
      path: filePath,
      status: "modified",
      diff: `--- ${filePath}\n+++ ${filePath}\n@@ -1 +1 @@\n-old\n+new`,
    })),
    diff: "diff",
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StatusPanel revert confirmation", () => {
  it("renders revert buttons and opens confirmation without calling the API", async () => {
    getGitStatusMock.mockResolvedValue(gitStatus(["app/page.tsx", "styles.css"]));

    render(<StatusPanel />);

    const firstRevert = await screen.findByRole("button", { name: "Revert app/page.tsx" });
    expect(screen.getByRole("button", { name: "Revert styles.css" })).toBeTruthy();

    fireEvent.click(firstRevert);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("app/page.tsx")).toBeTruthy();
    expect(revertGitFileMock).not.toHaveBeenCalled();
  });

  it("cancel and Escape close the dialog without an API call", async () => {
    getGitStatusMock.mockResolvedValue(gitStatus(["app/page.tsx"]));

    render(<StatusPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Revert app/page.tsx" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(revertGitFileMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Revert app/page.tsx" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(revertGitFileMock).not.toHaveBeenCalled();
  });

  it("confirm calls revertGitFile and refreshes the displayed list", async () => {
    getGitStatusMock.mockResolvedValue(gitStatus(["app/page.tsx", "styles.css"]));
    revertGitFileMock.mockResolvedValue(gitStatus(["styles.css"]));

    render(<StatusPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Revert app/page.tsx" }));
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));

    await waitFor(() => expect(revertGitFileMock).toHaveBeenCalledWith("app/page.tsx"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Revert app/page.tsx" })).toBeNull());
    expect(screen.getByRole("button", { name: "Revert styles.css" })).toBeTruthy();
  });

  it("displays an error when revert fails", async () => {
    getGitStatusMock.mockResolvedValue(gitStatus(["app/page.tsx"]));
    revertGitFileMock.mockRejectedValue(new Error("Unable to revert file."));

    render(<StatusPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Revert app/page.tsx" }));
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));

    expect(await screen.findByText("Unable to revert file.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revert app/page.tsx" })).toBeTruthy();
  });
});
