export type ItemType = 'long' | 'short'

export interface Section {
  heading: string
  content: string
}

export interface Item {
  id: string
  title: string
  type: ItemType
  sections: Section[]
  createdAt: number
}
