import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFixAction } from "@/core/fixRegistry";
import { ConfirmFixModal } from "./ConfirmFixModal";

describe("ConfirmFixModal", () => {
  it("requires acknowledgement before a moderate fix can run", () => {
    const fix = getFixAction("restart-adapter");
    const onConfirm = vi.fn();

    render(
      <ConfirmFixModal fix={fix} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />
    );

    const runButton = screen.getByRole("button", { name: /run allowlisted fix/i });
    expect(runButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));

    expect(runButton).toBeEnabled();

    fireEvent.click(runButton);

    expect(onConfirm).toHaveBeenCalledWith(fix, {
      acknowledged: true,
      typedPhrase: undefined
    });
  });

  it("clears typed aggressive confirmation when the modal closes", () => {
    const fix = getFixAction("tcpip-reset");
    const onConfirm = vi.fn();
    const view = render(
      <ConfirmFixModal fix={fix} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("RESET"), {
      target: { value: "RESET" }
    });

    expect(screen.getByRole("button", { name: /run allowlisted fix/i })).toBeEnabled();

    view.rerender(
      <ConfirmFixModal fix={null} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    view.rerender(
      <ConfirmFixModal fix={fix} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />
    );

    expect(screen.getByPlaceholderText("RESET")).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: /run allowlisted fix/i })).toBeDisabled();
  });
});
