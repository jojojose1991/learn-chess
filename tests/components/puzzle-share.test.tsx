import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PuzzleShare } from "@/components/puzzle-share"

const URL_TO_SEND = "https://learnchess.example/p/hk3mq7za"

/** What the button was handed to write, in the order it asked. */
let copied: Array<string> = []
let refuseClipboard = false

/**
 * jsdom has no clipboard at all, so the platform's own API is what is stood
 * in for here — not the component, and not a server function it calls.
 */
function withClipboard() {
  copied = []
  refuseClipboard = false
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (refuseClipboard) throw new Error("write permission denied")
        copied.push(text)
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
})

const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }))

/**
 * How a Coach gets a Puzzle to a Student. The block holds no link of its own:
 * `url` is what the server last said, so minting and revoking are visible
 * only once they have actually happened — a screen that showed a link the
 * moment it was asked for would show one that was never written.
 */
describe("sharing a Puzzle", () => {
  const nothing = async () => {}

  it("offers to create a link when there is none, and shows nothing to send yet", () => {
    render(<PuzzleShare onMint={nothing} onRevoke={nothing} />)

    expect(screen.getByRole("button", { name: "Create link" })).toBeVisible()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Revoke link" })
    ).not.toBeInTheDocument()
  })

  it("asks for a link when the Coach creates one", () => {
    const asked: Array<string> = []
    render(
      <PuzzleShare
        onMint={async () => {
          asked.push("mint")
        }}
        onRevoke={nothing}
      />
    )

    click("Create link")

    expect(asked).toEqual(["mint"])
  })

  it("shows the whole URL a Coach pastes, so it goes into a chat app as it is", () => {
    render(
      <PuzzleShare url={URL_TO_SEND} onMint={nothing} onRevoke={nothing} />
    )

    expect(screen.getByRole("textbox", { name: "Puzzle Link" })).toHaveValue(
      URL_TO_SEND
    )
    expect(
      screen.queryByRole("button", { name: "Create link" })
    ).not.toBeInTheDocument()
  })

  it("copies that URL and says so, because a Coach cannot see the clipboard", async () => {
    withClipboard()
    render(
      <PuzzleShare url={URL_TO_SEND} onMint={nothing} onRevoke={nothing} />
    )

    click("Copy link")

    expect(copied).toEqual([URL_TO_SEND])
    expect(await screen.findByText("Link copied")).toBeVisible()
  })

  it("says copying was refused rather than letting the Coach send an empty message", async () => {
    withClipboard()
    refuseClipboard = true
    render(
      <PuzzleShare url={URL_TO_SEND} onMint={nothing} onRevoke={nothing} />
    )

    click("Copy link")

    // The URL is still on screen to select by hand, which is the way out the
    // message points at.
    expect(
      await screen.findByText(
        "Copying is blocked here. Select the link and copy it yourself."
      )
    ).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Puzzle Link" })).toHaveValue(
      URL_TO_SEND
    )
  })

  it("says what happened, because the button that was pressed is gone once it lands", async () => {
    const { rerender } = render(
      <PuzzleShare onMint={nothing} onRevoke={nothing} />
    )

    click("Create link")
    // What a mint does is hand back a URL, so the block is re-rendered with
    // one — the same way the loader re-renders it.
    rerender(
      <PuzzleShare url={URL_TO_SEND} onMint={nothing} onRevoke={nothing} />
    )

    expect(await screen.findByText("Link created")).toBeVisible()
  })

  it("refuses to copy a link while it is being revoked, so nothing dead is pasted", async () => {
    withClipboard()
    let landRevoke = () => {}
    render(
      <PuzzleShare
        url={URL_TO_SEND}
        onMint={nothing}
        onRevoke={() => new Promise<void>((land) => (landRevoke = land))}
      />
    )

    click("Revoke link")

    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled()

    landRevoke()
    expect(await screen.findByText("Link revoked")).toBeVisible()
    expect(copied).toEqual([])
  })

  it("asks for the link to be revoked when the Coach ends the sharing", () => {
    const asked: Array<string> = []
    render(
      <PuzzleShare
        url={URL_TO_SEND}
        onMint={nothing}
        onRevoke={async () => {
          asked.push("revoke")
        }}
      />
    )

    click("Revoke link")

    expect(asked).toEqual(["revoke"])
  })

  it("says a mint that never landed did not work, rather than leaving the Coach waiting", async () => {
    render(
      <PuzzleShare
        onMint={() => Promise.reject(new Error("no answer"))}
        onRevoke={nothing}
      />
    )

    click("Create link")

    expect(
      await screen.findByText("That did not work. Try again.")
    ).toBeVisible()
    // Still offered, because the Coach's next move is to press it again.
    expect(screen.getByRole("button", { name: "Create link" })).toBeEnabled()
  })
})
