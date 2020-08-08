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
    desc: string
} | {
    id: number
    type: 'player'
    loc: Location | null
    items: number[]
}
type State = Record<string, Item>
let state: State = JSON.parse(readFileSync(STATE).toString())
const W = 30
const H = 30

const find = (loc: Location) => {
    return Object.values(state).find(i => i?.loc?.[0] === loc[0] && i?.loc?.[1] === loc[1])
}
const iterRange = (loc: Location, r: number, cb: (loc: Location) => void) => {
    for (let i = loc[0] - r; i < loc[0] + r; i++) {
        for (let j = loc[1] - r; j < loc[1] + r; j++) {
            if (i < 0 || j < 0) continue
            if (i >= H || j >= W) continue
            cb([i, j])
        }
    }
}
const drop = (loc: Location, items: number[]) => {
    // const v = find(loc)
    // if (v) {
    //     console.log('failed to drop')
    //     return
    // }
    // const item = state[`I${items.pop()!}`]
    // if (item?.type === 'player') {
    //     throw new Error('impossible')
    // }
    // item.loc = loc
    for (let r = 0; r < 5; r++) {
        iterRange(loc, r, ([y, x]) => {
            if (items.length === 0) return
            const v = find([y, x])
            if (v) {
                return
            }
            const item = state[`I${items.pop()!}`]
            if (item?.type === 'player') {
                throw new Error('impossible')
            }
            item.loc = [y, x]
        })
    }
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
        const teamId = parseInt(token[0])
        if (!(1 <= teamId && teamId <= 9)) {
            throw new Error('token is wrong: ' + token)
        }
        const team = `P${teamId}`
        const nps = ps.map(i => parseInt(i, 10))
        console.log('cmd', Cmds[ncmd], team)
        switch(ncmd) {
            case Cmds.Inspect: {
                const itemId = nps[0]
                const player = getPlayer(team)
                if (!player.items.some(i => i === itemId)) {
                    throw new Error('you cannot inspect an item you do not own')
                }
                const item = state[`I${itemId}`]

                if (item.type === 'item' && item.item_type === 'FLAG') {
                    return '{REAL_FLAG}'
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
                iterRange(player.loc, R, ([y, x]) => {
                    if (y === player.loc![0] && x === player.loc![1]) {
                        return
                    }
                    const v = find([y, x])
                    if (v) {
                        elems[getIndex(v)] = v
                    }
                })
                // for (let i = player.loc[0] - R; i < player.loc[0] + R; i++) {
                //     for (let j = player.loc[1] - R; j < player.loc[1] + R; j++) {
                //         if (i === player.loc[0] && j === player.loc[1]) {
                //             continue
                //         }
                //         const v = find([i, j])
                //         if (v) {
                //             elems[getIndex(v)] = v
                //         }
                //     }
                // }
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
                if (existing?.type !== 'player' || !existing.loc) {
                    throw new Error(`You can only attack live player`)
                }

                const l = existing.loc
                existing.loc = null
                drop(l, existing.items)
                existing.items = []

                return {
                    player: existing,
                }
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
    let last = 0
    const getT = () => Math.random() * 500 + 250
    rl.on('line', (input) => {
        try {
            const now = Date.now()
            if (now - last < getT()) {
                // throw new Error('hit rate limit, slow down')
            }
            last = Date.now()
            const [cmd, token, ...ps] = input.split(' ')
            if (cmd === 'AUTH') {
                s.write('{"status": "OK"}\n')
                return
            }
            let info = handler(cmd, token, ps)
            s.write(JSON.stringify({
                status: 'OK',
                info,
            }).replace(/":"/g, '": "') + '\n')
        } catch(e) {
            s.write(JSON.stringify({
                status: 'ERROR',
                error_msg: e.message.toString(),
            }).replace(/":"/g, '": "') + '\n')
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
