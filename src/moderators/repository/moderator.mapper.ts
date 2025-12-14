import type { ModeratorEntity } from "../entities/moderator.entity";
import type { ModeratorResponseDto } from "../dto/moderator-response.dto";

export class ModeratorMapper {
  static toResponseDto(entity: ModeratorEntity): ModeratorResponseDto {
    const parseDate = (dateValue: unknown): string => {
      if (!dateValue) return new Date().toISOString();
      try {
        const date = new Date(dateValue as string);
        if (isNaN(date.getTime())) return new Date().toISOString();
        return date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    return {
      uuid: entity.id,
      fullname: entity.fullname,
      email: entity.email,
      image: entity.image || undefined,
      createdAt: parseDate(entity.created_at),
    };
  }

  static toResponseDtos(entities: ModeratorEntity[]): ModeratorResponseDto[] {
    return entities.map((entity) => this.toResponseDto(entity));
  }
}

