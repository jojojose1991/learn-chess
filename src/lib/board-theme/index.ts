import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import * as boardTheme from "./service"

import type { BoardTheme } from "@/db/schema"

/** The Coach's chosen board, straight to `./service`. Nothing is re-exported
 * from here, so no server import follows the stub into the browser. */
export const chooseBoardTheme = createServerFn({ method: "POST" })
  .validator((data: BoardTheme) => data)
  .handler(({ data }) => boardTheme.chooseBoardTheme(data, getRequestHeaders()))
