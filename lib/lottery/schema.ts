import { z } from "zod";

const nullableText = z.string().nullable().optional();
const nullableLatitude = z.number().finite().min(-90).max(90).nullable();
const nullableLongitude = z.number().finite().min(-180).max(180).nullable();

export const lotteryShopSchema = z
  .object({
    rnum: z.number().int().positive(),
    ltShpId: z.string().trim().min(1),
    shpNm: z.string().trim().min(1).nullable(),
    shpTelno: nullableText,
    region: nullableText,
    tm1ShpLctnAddr: nullableText,
    tm2ShpLctnAddr: nullableText,
    tm3ShpLctnAddr: nullableText,
    tm4ShpLctnAddr: nullableText,
    shpAddr: nullableText,
    slrOperSttsCd: nullableText,
    l645LtNtslYn: z.string().nullable().optional(),
    pt720NtslYn: z.string().nullable().optional(),
    wnShpRnk: z.union([z.literal(1), z.literal(2)]),
    shpLat: nullableLatitude,
    shpLot: nullableLongitude,
  })
  .passthrough();

export const lotteryResponseSchema = z
  .object({
    data: z.object({
      list: z.array(lotteryShopSchema),
    }),
  })
  .passthrough();

export type LotteryShopResponse = z.infer<typeof lotteryShopSchema>;
