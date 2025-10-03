export type PoolMemberStatus = 'ALIVE' | 'ELIMINATED'

export type PoolMemberSummary = {
  name: string
  status: PoolMemberStatus
  livesRemaining: number
  roundsSurvived: number
  teamsUsed: string[]
  teamsAvailableCount: number
}

export type GameweekResult = 'WIN' | 'LOSS' | 'PENDING'

export type PoolPick = {
  player: string
  team: string | null
  result: GameweekResult
}

export type WeeklyPoolPicks = {
  gameweek: number
  picks: PoolPick[]
}

export type PoolFixture = {
  matchNumber: number
  round: number
  kickoffUtc: string
  location: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
}

export type PoolDashboardMockData = {
  poolName: string
  season: string
  currentGameweek: number
  deadlineUtc: string
  prizePot: string
  entryFee: string
  members: PoolMemberSummary[]
  weeklyPicks: WeeklyPoolPicks[]
  recentWinners: Record<number, string[]>
  upcomingFixtures: PoolFixture[]
}

const poolMembers: PoolMemberSummary[] = [
  {
    name: 'Zac',
    status: 'ALIVE',
    livesRemaining: 2,
    roundsSurvived: 6,
    teamsUsed: ['Tottenham', 'Bournemouth', "Nott'm Forest", 'Newcastle', 'Liverpool', 'Man City'],
    teamsAvailableCount: 14,
  },
  {
    name: 'Max',
    status: 'ELIMINATED',
    livesRemaining: 0,
    roundsSurvived: 2,
    teamsUsed: ['Everton', 'Arsenal', 'Man City', 'Chelsea'],
    teamsAvailableCount: 16,
  },
  {
    name: 'JJ',
    status: 'ALIVE',
    livesRemaining: 2,
    roundsSurvived: 6,
    teamsUsed: ['Tottenham', 'Chelsea', 'Man United', 'Fulham', 'Aston Villa', 'Man City'],
    teamsAvailableCount: 14,
  },
  {
    name: 'George',
    status: 'ALIVE',
    livesRemaining: 1,
    roundsSurvived: 5,
    teamsUsed: ['Everton', 'Arsenal', 'Chelsea', 'Aston Villa', 'Crystal Palace', 'Man City'],
    teamsAvailableCount: 14,
  },
  {
    name: 'Micheal',
    status: 'ALIVE',
    livesRemaining: 1,
    roundsSurvived: 5,
    teamsUsed: ['Man City', 'Arsenal', "Nott'm Forest", 'Liverpool', 'Crystal Palace', 'Chelsea'],
    teamsAvailableCount: 14,
  },
  {
    name: 'Koray',
    status: 'ALIVE',
    livesRemaining: 1,
    roundsSurvived: 5,
    teamsUsed: ['Sunderland', 'Arsenal', "Nott'm Forest", 'Aston Villa', 'Crystal Palace', 'Man City'],
    teamsAvailableCount: 14,
  },
]

const recentWinners: Record<number, string[]> = {
  1: ['Liverpool', 'Sunderland', 'Tottenham', 'Man City', "Nott'm Forest", 'Arsenal', 'Leeds'],
  2: ['Arsenal', 'Bournemouth', 'Chelsea'],
  3: ['Bournemouth', 'Chelsea', 'Man United'],
  4: ['Newcastle', 'Fulham', 'Liverpool'],
  5: ['Man United', 'Fulham', 'Leeds', 'Crystal Palace', 'Liverpool'],
  6: ['Man City'],
}

const weeklyPicks: WeeklyPoolPicks[] = [
  {
    gameweek: 1,
    picks: [
      { player: 'Zac', team: 'Tottenham', result: 'WIN' },
      { player: 'Max', team: 'Everton', result: 'LOSS' },
      { player: 'JJ', team: 'Tottenham', result: 'WIN' },
      { player: 'George', team: 'Everton', result: 'LOSS' },
      { player: 'Micheal', team: 'Man City', result: 'WIN' },
      { player: 'Koray', team: 'Sunderland', result: 'WIN' },
    ],
  },
  {
    gameweek: 2,
    picks: [
      { player: 'Zac', team: 'Bournemouth', result: 'WIN' },
      { player: 'Max', team: 'Arsenal', result: 'WIN' },
      { player: 'JJ', team: 'Chelsea', result: 'WIN' },
      { player: 'George', team: 'Arsenal', result: 'WIN' },
      { player: 'Micheal', team: 'Arsenal', result: 'WIN' },
      { player: 'Koray', team: 'Arsenal', result: 'WIN' },
    ],
  },
  {
    gameweek: 3,
    picks: [
      { player: 'Zac', team: "Nott'm Forest", result: 'LOSS' },
      { player: 'Max', team: 'Man City', result: 'LOSS' },
      { player: 'JJ', team: 'Man United', result: 'WIN' },
      { player: 'George', team: 'Chelsea', result: 'WIN' },
      { player: 'Micheal', team: "Nott'm Forest", result: 'LOSS' },
      { player: 'Koray', team: "Nott'm Forest", result: 'LOSS' },
    ],
  },
  {
    gameweek: 4,
    picks: [
      { player: 'Zac', team: 'Newcastle', result: 'WIN' },
      { player: 'Max', team: null, result: 'PENDING' },
      { player: 'JJ', team: 'Fulham', result: 'WIN' },
      { player: 'George', team: 'Aston Villa', result: 'LOSS' },
      { player: 'Micheal', team: 'Liverpool', result: 'WIN' },
      { player: 'Koray', team: 'Aston Villa', result: 'LOSS' },
    ],
  },
  {
    gameweek: 5,
    picks: [
      { player: 'Zac', team: 'Liverpool', result: 'WIN' },
      { player: 'Max', team: 'Chelsea', result: 'LOSS' },
      { player: 'JJ', team: 'Aston Villa', result: 'LOSS' },
      { player: 'George', team: 'Crystal Palace', result: 'WIN' },
      { player: 'Micheal', team: 'Crystal Palace', result: 'WIN' },
      { player: 'Koray', team: 'Crystal Palace', result: 'WIN' },
    ],
  },
  {
    gameweek: 6,
    picks: [
      { player: 'Zac', team: 'Man City', result: 'WIN' },
      { player: 'Max', team: null, result: 'PENDING' },
      { player: 'JJ', team: 'Man City', result: 'WIN' },
      { player: 'George', team: 'Man City', result: 'WIN' },
      { player: 'Micheal', team: 'Chelsea', result: 'LOSS' },
      { player: 'Koray', team: 'Man City', result: 'WIN' },
    ],
  },
]

const upcomingFixtures: PoolFixture[] = [
  {
    matchNumber: 63,
    round: 7,
    kickoffUtc: '2025-10-03T19:00:00Z',
    location: 'Vitality Stadium',
    homeTeam: 'Bournemouth',
    awayTeam: 'Fulham',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 67,
    round: 7,
    kickoffUtc: '2025-10-04T11:30:00Z',
    location: 'Elland Road',
    homeTeam: 'Leeds',
    awayTeam: 'Spurs',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 61,
    round: 7,
    kickoffUtc: '2025-10-04T14:00:00Z',
    location: 'Emirates Stadium',
    homeTeam: 'Arsenal',
    awayTeam: 'West Ham',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 68,
    round: 7,
    kickoffUtc: '2025-10-04T14:00:00Z',
    location: 'Old Trafford',
    homeTeam: 'Man Utd',
    awayTeam: 'Sunderland',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 65,
    round: 7,
    kickoffUtc: '2025-10-04T16:30:00Z',
    location: 'Stamford Bridge',
    homeTeam: 'Chelsea',
    awayTeam: 'Liverpool',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 62,
    round: 7,
    kickoffUtc: '2025-10-05T13:00:00Z',
    location: 'Villa Park',
    homeTeam: 'Aston Villa',
    awayTeam: 'Burnley',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 66,
    round: 7,
    kickoffUtc: '2025-10-05T13:00:00Z',
    location: 'Hill Dickinson Stadium',
    homeTeam: 'Everton',
    awayTeam: 'Crystal Palace',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 69,
    round: 7,
    kickoffUtc: '2025-10-05T13:00:00Z',
    location: "St. James' Park",
    homeTeam: 'Newcastle',
    awayTeam: "Nott'm Forest",
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 70,
    round: 7,
    kickoffUtc: '2025-10-05T13:00:00Z',
    location: 'Molineux Stadium',
    homeTeam: 'Wolves',
    awayTeam: 'Brighton',
    homeScore: null,
    awayScore: null,
  },
  {
    matchNumber: 64,
    round: 7,
    kickoffUtc: '2025-10-05T15:30:00Z',
    location: 'Gtech Community Stadium',
    homeTeam: 'Brentford',
    awayTeam: 'Man City',
    homeScore: null,
    awayScore: null,
  },
]

export const poolDashboardMock: PoolDashboardMockData = {
  poolName: 'North London Derby Club',
  season: '2025/26',
  currentGameweek: 7,
  deadlineUtc: '2025-10-04T10:00:00Z',
  prizePot: '£280',
  entryFee: '£60',
  members: poolMembers,
  weeklyPicks,
  recentWinners,
  upcomingFixtures,
}
