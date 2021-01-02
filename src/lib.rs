mod utils;

// #![allow(dead_code)]
use js_sys::Array;
use wasm_bindgen::prelude::*;
use bimap::BiMap;
use std::hash::{Hash, Hasher};
use std::fs::File;
use std::time::Instant;


#[wasm_bindgen]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ID(usize);

#[wasm_bindgen]
impl ID {
    fn fetch_from(self, sp: &Space) -> &QTree {
        match sp.table.get_by_left(&self) {
            Some(tree) => tree,
            None => {
                panic!("Found None, while trying to fetch tree with id={:?}", self)
            }
        }
    }

    fn fetch_node(self, sp: &Space) -> &Node {
        if let QTree::Node(node) = self.fetch_from(sp) {
            node
        } else {
            let x = self.fetch_from(sp);
            panic!(
                "Fetch failed; found {:?} while looking for Node with id={:?}",
                x, self
            );
        }
    }
}

#[derive(Debug, PartialEq, Eq, Hash)]
pub enum QTree {
    Node(Node),
    Leaf(Leaf),
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Leaf(usize);

#[derive(Debug)]
pub struct Node {
    level: usize,
    pop: usize,
    next: Option<ID>,
    north_west: ID,
    north_east: ID,
    south_west: ID,
    south_east: ID,
}

impl Eq for Node {}

impl PartialEq for Node {
    fn eq(&self, other: &Self) -> bool {
        self.north_west == other.north_west && self.north_east == other.north_east && self.south_west == other.south_west && self.south_east== other.south_east
    }
}

impl Hash for Node {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.north_west.hash(state);
        self.north_east.hash(state);
        self.south_west.hash(state);
        self.south_east.hash(state);
    }
}

impl QTree {
    #[inline(always)]
    pub(crate) fn population(&self) -> usize {
        match *self {
            QTree::Node(ref i) => i.pop,
            QTree::Leaf(c) => c.0 as usize,
        }
    }
}

#[wasm_bindgen]
pub struct Coord {
    x: i32,
    y: i32
}

#[wasm_bindgen]
pub struct Space {
    table: BiMap<ID, QTree>,
    root: Option<ID>,
}

#[wasm_bindgen]
impl Space {
    pub fn new() -> Space {
        let mut t: BiMap<ID, QTree> = BiMap::new();
        Space {
            table: t,
            root: None
        }
    }

    fn get_id(&mut self, node: QTree) -> ID {
        match self.table.get_by_right(&node) {
            Some(id) => *id,
            _ => {
                let id = ID(self.table.len());
                self.table.insert(id, node);
                id
            }
        }
    }

    fn new_leaf(&mut self, state: usize) -> ID {
        let node = QTree::Leaf(Leaf(state));
        self.get_id(node)
    }

    fn new_node(&mut self, nw_id: ID, ne_id: ID, sw_id: ID, se_id: ID) -> ID {
        let children = (
            nw_id.fetch_from(self),
            ne_id.fetch_from(self),
            sw_id.fetch_from(self),
            se_id.fetch_from(self),
        );
        let n = match children {
            (QTree::Node(nw), QTree::Node(ne), QTree::Node(sw), QTree::Node(se)) => 
                Node {
                    level: nw.level + 1,
                    pop: nw.pop + ne.pop + sw.pop + se.pop,
                    next: None,
                    north_west: nw_id,
                    north_east: ne_id,
                    south_west: sw_id,
                    south_east: se_id,
                },
            (QTree::Leaf(nw), QTree::Leaf(ne), QTree::Leaf(sw), QTree::Leaf(se)) => 
                Node {
                    level: 1,
                    pop: [nw, ne, sw, se].iter().filter(|c| c.0 > 0).count() as usize,
                    next: None,
                    north_west: nw_id,
                    north_east: ne_id,
                    south_west: sw_id,
                    south_east: se_id,
                },
            _ => panic!("Attempting to create a node containing leaves & nodes!"),
        };
        self.get_id(QTree::Node(n))
    }

    #[wasm_bindgen]
    pub fn empty_tree(&mut self, level: usize) -> ID {
        if level == 0 {
            self.new_leaf(0)
        } else {
            let c = Self::empty_tree(self, level - 1);
            self.new_node(c, c, c, c)
        }
    }

    pub fn set_root(&mut self, root_id: ID) {
        self.root = Some(root_id);
    }

    pub fn set_pos(&mut self, x: usize, y: usize) {
        let r = self.root.unwrap();
        self.root = Some(self.set_tree_pos(r, x, y, 1))
    }
    
    pub fn coords(&mut self, x: i32, y: i32) -> Array {
        let r = self.root.unwrap();
        let root_node = r.fetch_node(self);
        let k = 2u32.pow(root_node.level as u32 - 1);
        // self.get_coords_wasm(r, -(k as i32), -(k as i32))
        self.get_coords_wasm(r, x-(k as i32), y-(k as i32))
        // self.get_coords_wasm(r, x, y)
    }

    #[wasm_bindgen]
    pub fn set_tree_pos(&mut self, tree: ID, x: usize, y: usize, pop2: usize) -> ID {
        match *tree.fetch_from(self) {
            QTree::Leaf(_) => self.new_leaf(pop2),
            QTree::Node(Node {
                level,
                pop: _,
                next: _,
                north_west,
                north_east,
                south_west,
                south_east,
            }) => {
                let dim = 2usize.pow(level as u32 - 1);
                if x < dim && y < dim {
                    let new_sw = self.set_tree_pos(south_west, x, y, pop2);
                    self.new_node(north_west, north_east, new_sw, south_east)
                } else if x < dim && y >= dim {
                    let new_nw = self.set_tree_pos(north_west, x, y - dim, pop2);
                    self.new_node(new_nw, north_east, south_west, south_east)
                } else if x >= dim && y < dim {
                    let new_se = self.set_tree_pos(south_east, x - dim, y, pop2);
                    self.new_node(north_west, north_east, south_west, new_se)
                } else if x >= dim && y >= dim {
                    let new_ne = self.set_tree_pos(north_east, x - dim, y - dim, pop2);
                    self.new_node(north_west, new_ne, south_west, south_east)
                } else {
                    ID(666)
                }
            }
        }
    }

    fn get_tree_cell(&self, tree_id: ID, x: usize, y: usize) -> usize {
        match *tree_id.fetch_from(self) {
            QTree::Leaf(c) => c.0,
            QTree::Node(Node {
                level,
                pop: _,
                next: _,
                north_west,
                north_east,
                south_west,
                south_east,
            }) => {
                let dim = 2usize.pow(level as u32 - 1);
                if x < dim && y < dim {
                    self.get_tree_cell(south_west, x, y)
                } else if x < dim && y >= dim {
                    self.get_tree_cell(north_west, x, y - dim)
                } else if x >= dim && y < dim {
                    self.get_tree_cell(south_east, x - dim, y)
                } else if x >= dim && y >= dim {
                    self.get_tree_cell(north_east, x - dim, y - dim)
                } else {
                    666
                }
            }
        }
    }

    fn expand_tree(&mut self, tree_id: ID) -> ID {
        let level = tree_id.fetch_node(self).level;
        let border = self.empty_tree(level - 1);
        let (root_nw, root_ne, root_sw, root_se) = {
            let root = tree_id.fetch_node(self);
            (
                root.north_west,
                root.north_east,
                root.south_west,
                root.south_east,
            )
        };
        let (nw, ne, sw, se) = (
            self.new_node(border, border, border, root_nw),
            self.new_node(border, border, root_ne, border),
            self.new_node(border, root_sw, border, border),
            self.new_node(root_se, border, border, border),
        );
        self.new_node(nw, ne, sw, se)
    }

    // #[wasm_bindgen]
    pub fn get_coords_wasm(&self, tree_id: ID, x: i32, y: i32) -> Array {
        let root_node = self.root.unwrap().fetch_node(self);
        let mut results: Vec<i32> = vec![];
        for (cx, cy) in self.get_coords(tree_id, x, y) {
            results.push(cx);
            results.push(cy);
        }
        results.into_iter().map(JsValue::from).collect()
    }

    fn get_coords(&self, tree_id: ID, x: i32, y: i32) -> Vec<(i32, i32)> {
        match tree_id.fetch_from(&self) {
            QTree::Node(Node {
                pop,
                level,
                next: _,
                north_west,
                north_east,
                south_west,
                south_east,
            }) => {
                if *pop > 0 {
                    let dim = 2i32.pow(*level as u32 - 1);
                    let mut results = vec![];
                    results.append(&mut self.get_coords(*north_west, x, y + dim));
                    results.append(&mut self.get_coords(*north_east, x + dim, y + dim));
                    results.append(&mut self.get_coords(*south_west, x, y));
                    results.append(&mut self.get_coords(*south_east, x + dim, y));
                    results
                } else {
                    vec![]
                }
            }
            QTree::Leaf(Leaf(0)) => vec![],
            QTree::Leaf(_) => vec![(x, y)],
        }
    }

    fn centered_horizontal(&mut self, west: ID, east: ID) -> ID {
        let (west, east) = (west.fetch_node(self), east.fetch_node(self));
        debug_assert!(west.level == east.level, "levels must be the same");

        let (nw, ne, sw, se) = (
            west.north_east.fetch_node(self).south_east,
            east.north_west.fetch_node(self).south_west,
            west.south_east.fetch_node(self).north_east,
            east.south_west.fetch_node(self).north_west,
        );
        self.new_node(nw, ne, sw, se)
    }

    fn centered_vertical(&mut self, north: ID, south: ID) -> ID {
        let (north, south) = (north.fetch_node(self), south.fetch_node(self));
        debug_assert!(north.level == south.level, "levels must be the same");

        let (nw, ne, sw, se) = (
            north.south_west.fetch_node(self).south_east,
            north.south_east.fetch_node(self).south_west,
            south.north_west.fetch_node(self).north_east,
            south.north_east.fetch_node(self).north_west,
        );
        self.new_node(nw, ne, sw, se)
    }

    fn centered_sub(&mut self, id: ID) -> ID {
        let node = id.fetch_node(self);
        let (nw, ne, sw, se) = (
            node.north_west.fetch_node(self).south_east,
            node.north_east.fetch_node(self).south_west,
            node.south_west.fetch_node(self).north_east,
            node.south_east.fetch_node(self).north_west,
        );
        self.new_node(nw, ne, sw, se)
    }

    fn centered_subsub(&mut self, node: ID) -> ID {
        let node = node.fetch_node(self);
        let (nw, ne, sw, se) = (
            node.north_west
                .fetch_node(self)
                .south_east
                .fetch_node(self)
                .south_east,
            node.north_east
                .fetch_node(self)
                .south_west
                .fetch_node(self)
                .south_west,
            node.south_west
                .fetch_node(self)
                .north_east
                .fetch_node(self)
                .north_east,
            node.south_east
                .fetch_node(self)
                .north_west
                .fetch_node(self)
                .north_west,
        );
        self.new_node(nw, ne, sw, se)
    }

    fn evolve_tree(&mut self, tree_id: ID) -> ID {
        {
            let inode = tree_id.fetch_node(self);
            debug_assert!(inode.level >= 2, "must be level 2 or higher");
        }

        if let Some(next) = tree_id.fetch_node(self).next {
            return next;
        }

        if tree_id.fetch_node(self).level == 2 {
            self.evolve4x4(tree_id)
        } else {

            let (tree_nw, tree_ne, tree_sw, tree_se) = {
                let n = tree_id.fetch_node(self);
                (n.north_west, n.north_east, n.south_west, n.south_east)
            };
            
            let n00 = self.centered_sub(tree_nw);
            let n01 = self.centered_horizontal(tree_nw, tree_ne);
            let n02 = self.centered_sub(tree_ne);
            let n10 = self.centered_vertical(tree_nw, tree_sw);
            let n11 = self.centered_subsub(tree_id);
            let n12 = self.centered_vertical(tree_ne, tree_se);
            let n20 = self.centered_sub(tree_sw);
            let n21 = self.centered_horizontal(tree_sw, tree_se);
            let n22 = self.centered_sub(tree_se);

            let (nw, ne, sw, se) = {
                let nw = self.new_node(n00, n01, n10, n11);
                let ne = self.new_node(n01, n02, n11, n12);
                let sw = self.new_node(n10, n11, n20, n21);
                let se = self.new_node(n11, n12, n21, n22);
                (
                    self.evolve_tree(nw),
                    self.evolve_tree(ne),
                    self.evolve_tree(sw),
                    self.evolve_tree(se),
                )
            };

            let result = self.new_node(nw, ne, sw, se);

            let (xid, x) = self.table.remove_by_left(&tree_id).unwrap();

            match x {
                QTree::Node(Node {
                    pop,
                    level,
                    next,
                    north_west,
                    north_east,
                    south_west,
                    south_east,
                }) => {
                    let new_node = QTree::Node(Node {
                        level: level,
                        pop: pop,
                        next: Some(result),
                        north_west: north_west,
                        north_east: north_east,
                        south_west: south_west,
                        south_east: south_east,
                    });
                    match self.table.get_by_right(&new_node) {
                        Some(id) => {
                            return *id;
                        },
                        _ => {
                            self.table.insert(tree_id, new_node);
                        }
                    }
                }
                QTree::Leaf(level) => unimplemented!("Need to copy leaf correctly.")
            };

            result
        }
    }

    #[wasm_bindgen]
    pub fn advance(&mut self, steps: usize) {
        let mut tid = self.root.unwrap();
        loop {
            let tree = tid.fetch_node(self);
            // let iroot = self.root.unwrap().inode(self);
            let (nw_pop, ne_pop, sw_pop, se_pop) = (
                tree.north_west.fetch_from(self).population(),
                tree.north_east.fetch_from(self).population(),
                tree.south_west.fetch_from(self).population(),
                tree.south_east.fetch_from(self).population(),
            );

            let (nw_inner_pop, ne_inner_pop, sw_inner_pop, se_inner_pop) = (
                tree
                    .north_west
                    .fetch_node(self)
                    .south_east
                    .fetch_node(self)
                    .south_east
                    .fetch_from(self)
                    .population(),
                tree
                    .north_east
                    .fetch_node(self)
                    .south_west
                    .fetch_node(self)
                    .south_west
                    .fetch_from(self)
                    .population(),
                tree
                    .south_west
                    .fetch_node(self)
                    .north_east
                    .fetch_node(self)
                    .north_east
                    .fetch_from(self)
                    .population(),
                tree
                    .south_east
                    .fetch_node(self)
                    .north_west
                    .fetch_node(self)
                    .north_west
                    .fetch_from(self)
                    .population(),
            );

            if tid.fetch_node(self).level >= 3
                && nw_pop == nw_inner_pop
                && ne_pop == ne_inner_pop
                && sw_pop == sw_inner_pop
                && se_pop == se_inner_pop
            {
                break;
            }
            // println!("Expanding!");
            tid = self.expand_tree(tid);
        }
        self.root = Some(self.evolve_tree(tid))
    }

    fn evolve4x4(&mut self, node_id: ID) -> ID {
        let inode = node_id.fetch_node(self);
        debug_assert!(
            inode.level == 2,
            "manual evolution only at level 2 possible"
        );
        let mut bits: u16 = 0;
        for y in 0..4 {
            for x in 0..4 {
                bits = (bits << 1) + self.get_tree_cell(node_id, x, y) as u16;
            }
        }
        let (nw, ne, sw, se) = (
            self.life(bits >> 5),
            self.life(bits >> 4),
            self.life(bits >> 1),
            self.life(bits),
        );
        let result = self.new_node(sw, se, nw, ne);
        result
    }

    fn life(&mut self, mut bitmask: u16) -> ID {
        if bitmask == 0 {
            return self.new_leaf(0);
        }
        let center = (bitmask >> 5) & 1;
        bitmask &= 0b00000__111_0101_0111;
        let ncount = bitmask.count_ones();
        if ncount == 3 || (ncount == 2 && center != 0) {
            self.new_leaf(1)
        } else {
            self.new_leaf(0)
        }
    }
}


// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&(format!("Hello, {}", name)));
}

#[wasm_bindgen]
pub fn render() -> String {
    return "01".to_string();
}

