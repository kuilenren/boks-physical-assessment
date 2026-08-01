import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  NotFoundException,
} from "@nestjs/common";
import {
  createChildRequestSchema,
  type Child,
  type CreateChildRequest,
} from "@boks/contracts";
import { success } from "./http.js";
import { buildChild, children, getChild } from "./demo-store.js";
import { parseInput } from "./validation.js";

@Controller()
export class FamilyController {
  @Get("families/me")
  getFamily(@Headers("x-trace-id") traceId?: string) {
    return success(
      {
        id: "family-demo-001",
        display_name: "BOKS 演示家庭",
        children: children.filter((child) => child.profile_status === "active"),
      },
      traceId,
    );
  }

  @Get("families/me/children")
  getChildren(@Headers("x-trace-id") traceId?: string) {
    return success(
      children.filter((child) => child.profile_status === "active"),
      traceId,
    );
  }

  @Post("families/me/children")
  createChild(@Body() body: unknown, @Headers("x-trace-id") traceId?: string) {
    const input = parseInput(createChildRequestSchema, body);
    const child = buildChild(
      input as Omit<Child, "id" | "age_in_months" | "profile_status">,
    );
    children.push(child);
    return success(child, traceId);
  }

  @Get("children/:childId")
  getChild(
    @Param("childId") childId: string,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const child = getChild(childId);
    if (!child) {
      throw new NotFoundException("儿童档案不存在。");
    }
    return success(child, traceId);
  }

  @Patch("children/:childId")
  updateChild(
    @Param("childId") childId: string,
    @Body() body: unknown,
    @Headers("x-trace-id") traceId?: string,
  ) {
    const child = getChild(childId);
    if (!child) {
      throw new NotFoundException("儿童档案不存在。");
    }
    const input = parseInput(
      createChildRequestSchema.partial(),
      body,
    ) as Partial<CreateChildRequest>;
    Object.assign(child, input);
    return success(child, traceId);
  }
}
