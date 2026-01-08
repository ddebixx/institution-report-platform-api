import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("Health")
@Controller()
export class HealthController {
  @Get()
  @ApiOperation({
    summary: "Root endpoint",
    description: "Returns API information and status",
  })
  @ApiResponse({
    status: 200,
    description: "API is running",
  })
  getRoot(): { message: string; timestamp: string; version: string } {
    return {
      message: "Institution Report Platform API is running",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  @Get("health")
  @ApiOperation({
    summary: "Health check endpoint",
    description: "Check if the API is healthy and responsive",
  })
  @ApiResponse({
    status: 200,
    description: "API is healthy",
  })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ping")
  @ApiOperation({
    summary: "Ping endpoint",
    description: "Simple ping endpoint for connectivity tests",
  })
  @ApiResponse({
    status: 200,
    description: "Pong response",
  })
  getPing(): { message: string } {
    return { message: "pong" };
  }
}

