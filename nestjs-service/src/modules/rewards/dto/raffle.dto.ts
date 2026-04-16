export class RafflePrizeResponseDto {
  id!: number;
  title!: string;
  description!: string | null;
  imageUrl!: string | null;
  quantity!: number;
  sortOrder!: number;
}

export class RaffleWinnerResponseDto {
  id!: number;
  prizeId!: number;
  prizeTitle!: string;
  userId!: number;
  userName!: string | null;
  ticketId!: number;
  ticketNumber!: number;
  selectedAt!: string;
}

export class RaffleListItemResponseDto {
  id!: number;
  title!: string;
  description!: string | null;
  status!: 'draft' | 'active' | 'drawing' | 'completed' | 'completed_without_entries' | 'cancelled';
  ticketPrice!: number;
  maxTicketsPerUser!: number | null;
  winnersCount!: number;
  coverImageUrl!: string | null;
  isVisible!: boolean;
  startsAt!: string;
  endsAt!: string;
  completedAt!: string | null;
  totalTickets!: number;
  myTicketsCount!: number;
  prizes!: RafflePrizeResponseDto[];
  winners!: RaffleWinnerResponseDto[];
}

export class RaffleDetailResponseDto extends RaffleListItemResponseDto {}

export class MyRaffleEntryResponseDto {
  raffleId!: number;
  raffleTitle!: string;
  status!: 'draft' | 'active' | 'drawing' | 'completed' | 'completed_without_entries' | 'cancelled';
  ticketPrice!: number;
  startsAt!: string;
  endsAt!: string;
  completedAt!: string | null;
  ticketsCount!: number;
  ticketNumbers!: number[];
  prizes!: RafflePrizeResponseDto[];
  winners!: RaffleWinnerResponseDto[];
  isWinner!: boolean;
}

export class PurchaseRaffleTicketsRequestDto {
  quantity!: number;
}

export class PurchaseRaffleTicketsResponseDto {
  raffleId!: number;
  ticketsPurchased!: number;
  ticketIds!: number[];
  ticketNumbers!: number[];
}

export class AdminRafflePrizeInputDto {
  id?: number;
  title!: string;
  description?: string | null;
  imageUrl?: string | null;
  quantity!: number;
  sortOrder?: number;
}

export class AdminCreateRaffleDto {
  title!: string;
  description?: string | null;
  ticketPrice!: number;
  maxTicketsPerUser?: number | null;
  winnersCount!: number;
  coverImageUrl?: string | null;
  isVisible?: number;
  startsAt!: string;
  endsAt!: string;
  prizes!: AdminRafflePrizeInputDto[];
}

export class AdminUpdateRaffleDto {
  title?: string;
  description?: string | null;
  status?: 'draft' | 'active' | 'drawing' | 'completed' | 'completed_without_entries' | 'cancelled';
  ticketPrice?: number;
  maxTicketsPerUser?: number | null;
  winnersCount?: number;
  coverImageUrl?: string | null;
  isVisible?: number;
  startsAt?: string;
  endsAt?: string;
  prizes?: AdminRafflePrizeInputDto[];
}

export class AdminRaffleListItemResponseDto {
  id!: number;
  title!: string;
  status!: 'draft' | 'active' | 'drawing' | 'completed' | 'completed_without_entries' | 'cancelled';
  ticketPrice!: number;
  totalTickets!: number;
  uniqueParticipants!: number;
  winnersCount!: number;
  startsAt!: string;
  endsAt!: string;
  completedAt!: string | null;
  isVisible!: boolean;
}

export class AdminRaffleParticipantResponseDto {
  userId!: number;
  userName!: string | null;
  ticketsCount!: number;
  ticketNumbers!: number[];
}

export class AdminRaffleDetailResponseDto extends AdminRaffleListItemResponseDto {
  description!: string | null;
  maxTicketsPerUser!: number | null;
  coverImageUrl!: string | null;
  prizes!: RafflePrizeResponseDto[];
  winners!: RaffleWinnerResponseDto[];
  participants!: AdminRaffleParticipantResponseDto[];
}
