import { SchemaFactory } from 'fluid-framework'

const sf = new SchemaFactory('fantasic-hectic-linguine')

export class Counter extends sf.object('Counter', {
  count: sf.number,
}) {
  increment(): void {
    this.count += 1
  }
}
