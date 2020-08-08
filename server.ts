const STATE = './1596846885.json'

import { createServer, Socket } from 'net'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import express from 'express'

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
    id: number
    type: 'player'
    loc: Location | null
    items: number[]
}
type State = Record<string, Item>
let state: State = JSON.parse(readFileSync(STATE).toString())

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
const getIndex = (item: Item) => {
    if (item.type === 'item') {
        return `I${item.id}`
    } else if (item.type === 'player') {
        return `P${item.id}`
    }
    throw new Error('Can not getIndex')
}
const R = 5

let sockets: Socket[] = []
const server = createServer((s) => {
    sockets.push(s)
    const rl = createInterface({
        input: s,
        // output: s,
    })
    const handler = (cmd: string, token: string, ps: string[]) => {
        const ncmd = parseInt(cmd)
        const team = `P${parseInt(token[0])}`
        const nps = ps.map(i => parseInt(i, 10))
        console.log('cmd', Cmds[ncmd], team)
        switch(ncmd) {
            case Cmds.Inspect: {
                const itemId = nps[0]
                const player = getPlayer(team)
                const item = player.items.some(i => i === itemId)
                if (!item) {
                    throw new Error('you cannot inspect an item you do not own')
                }

                return {
                    item
                }
            }
            case Cmds.Elems: {
                const player = getPlayer(team)
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                let elems: Record<string, Item> = {}
                for (let i = player.loc[0] - R; i < player.loc[0] + R; i++) {
                    for (let j = player.loc[1] - R; j < player.loc[1] + R; j++) {
                        if (i === player.loc[0] && j === player.loc[1]) {
                            continue
                        }
                        const v = find([i, j])
                        if (v) {
                            elems[getIndex(v)] = v
                        }
                    }
                }
                return {
                    elems,
                }
            }
            case Cmds.Player: {
                const player = getPlayer(team)
                const items: Record<string, Item> = {}
                for (const i of player.items.map(id => state[`I${id}`])) {
                    items[`I${i.id}`] = i
                }
                return {
                    player,
                    items,
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

                return {
                    item: existing
                }
            }
            case Cmds.Attack: {
                console.log('atk', team, nps)
                const player = getPlayer(team)
                if (!player.loc) {
                    throw new Error('Your dead')
                }
                const newPos: Location = locRelative(player.loc, nps[2])
                console.log('newPos', newPos)
                const existing = find(newPos)
                if (existing?.type !== 'player') {
                    throw new Error(`You can only attack player`)
                }

                existing.loc = null
                return
            }
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
                throw new Error('Wrong cmd')
        }
    }
    rl.on('line', (input) => {
        try {
            const [cmd, token, ...ps] = input.split(' ')
            if (cmd === 'AUTH') {
                s.write('{"status":"OK"}\n')
                return
            }
            let info = handler(cmd, token, ps)
            s.write(JSON.stringify({
                status: 'OK',
                info,
            }) + '\n')
        } catch(e) {
            s.write(JSON.stringify({
                status: 'ERROR',
                error_msg: e.message.toString(),
            }) + '\n')
        }
    })
    s.write('HI\n')

})

server.listen(6666, '0.0.0.0')
console.log('listening on 127.0.0.1:6666')

const app = express()
const port = 8080

app.get('/', (req, res) => res.sendFile(__dirname + '/home.html'))
app.get('/reset', (req, res) => {
    for (const s of sockets) {
        s.end()
    }
    sockets = []
    state = JSON.parse(readFileSync(STATE).toString())
    res.send('Ok')
})
app.get('/state.json', (req, res) => {
    res.json({
        meta: {
            timestamp: new Date()
        },
        elems: state
    })
})

app.listen(port, '0.0.0.0', () => console.log(`Example app listening on port 127.0.0.1:${port}`))
console.log(`web listening on 127.0.0.1:${port}`)
