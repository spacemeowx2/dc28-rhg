import { createServer } from 'net'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'

enum Cmds {
    Move = 2614795397,
    Pick = 1169593071,
    Drop = 19469882,
    Player = 3623901639,
    // 10x10
    Elems = 1415591046,
    Inspect = 1083909441,
    Buy = 1326992884,
    Sell = 3777183679,
    Attack = 2257090568,
    Change1 = 249513676,
    Change2 = 817636993,
    Quit = 3509139905,
}

enum Params {
    Up = 1026868169,
    Down = 3930400191,
    Left = 4271926414,
    Right = 4265964054,
}

const LocMap: Record<number, [number, number] | undefined> = {
    [Params.Up]: [-1, 0],
    [Params.Down]: [1, 0],
    [Params.Left]: [0, -1],
    [Params.Right]: [0, 1],
}

type Location = [number, number]
type Item = {
    id: number
    type: 'item'
    item_type: string
    loc: Location | null
} | {
    type: 'player'
    loc: Location | null
    items: number[]
}
type State = Record<string, Item>
const state: State = JSON.parse(readFileSync('../jsons/1596846885.json').toString())

const find = (loc: Location) => {
    return Object.values(state).find(i => i?.loc?.[0] === loc[0] && i?.loc?.[1] === loc[1])
}

const locRelative = (loc: Location, d: number) => {
    const dir = LocMap[d]
    if (!dir) {
        throw new Error('Wrong args')
    }
    const [dy, dx] = dir
    const newPos: Location = [loc[0] + dy, loc[1] + dx]
    return newPos
}

// team: P1
const getPlayer = (team: string) => {
    const n =  state[team]
    if (n.type !== 'player') {
        throw new Error('Assert error player')
    }
    return n
}
const R = 5

const server = createServer((s) => {
    const rl = createInterface({
        input: s,
        // output: s,
    })
    const handler = (cmd: string, token: string, ps: string[]) => {
        const ncmd = parseInt(cmd)
        const team = `P${parseInt(token[0])}`
        const nps = ps.map(i => parseInt(i, 10))
        switch(ncmd) {
            case Cmds.Elems: {
                const player = getPlayer(team)
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                let elems: Item[] = []
                for (let i = player.loc[0] - R; i < player.loc[0] + R; i++) {
                    for (let j = player.loc[1] - R; j < player.loc[1] + R; j++) {
                        const v = find([i, j])
                        if (v) {
                            elems.push(v)
                        }
                    }
                }
                return {
                    elems,
                }
            }
            case Cmds.Player: {
                const player = getPlayer(team)
                return {
                    player,
                    items: player.items.map(id => state[`I${id}`])
                }
            }
            case Cmds.Pick: {
                const player = getPlayer(team)
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                const newPos: Location = locRelative(player.loc, nps[0])
                const existing = find(newPos)
                if (!existing) {
                    throw new Error('nothing to pick')
                }
                existing.loc = null
                if (existing.type !== 'item') {
                    throw new Error('You can only pick a item')
                }
                player.items.push(existing.id)

                return
            }
            case Cmds.Attack:
                return
            case Cmds.Move: {
                const player = state[team]
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                const newPos: Location = locRelative(player.loc, nps[0])
                const existing = find(newPos)
                if (existing) {
                    if (existing.type === 'item' && existing.item_type === 'WATER') {
                        console.log(team, 'dead')
                        player.loc = null
                        return
                    } else {
                        throw new Error('spot not empty')
                    }
                }
                player.loc = newPos
                return
            }
            default:
                console.log('unknown cmd', Cmds[ncmd], token, nps)
        }
    }
    rl.on('line', (input) => {
        try {
            const [cmd, token, ...ps] = input.split(' ')
            if (cmd === 'AUTH') {
                s.write('OK\n')
                return
            }
            let info = handler(cmd, token, ps)
            s.write(JSON.stringify({
                status: 'OK',
                info,
            }))
        } catch(e) {
            s.write(JSON.stringify({
                status: 'ERROR',
                error_msg: e.message.toString(),
            }))
        }
    })
    s.write('HI\n')

})

server.listen(6666)
console.log('listening on 127.0.0.1:6666')
