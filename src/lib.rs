mod utils;
mod gol;

// #![allow(dead_code)]
use js_sys::Array;
use wasm_bindgen::prelude::*;



// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;


/// # Universe API
/// Provides an interface for working with Gosper's Algorithm using absolute coordinates.

#[wasm_bindgen]
pub struct Universe {
    rootX: i32,
    rootY: i32,
    space: gol::Space,
    root_id: gol::ID
}

#[wasm_bindgen]
impl Universe {

    /// Universe constructor
    pub fn new(rx: i32, ry: i32) -> Universe {
        let mut space = gol::Space::new();
        let root_id = space.empty_tree(1);
        Universe {
            rootX: rx,
            rootY: ry,
            space: space,
            root_id: root_id
        }
    }

    pub fn set(&mut self, x: i32, y: i32) {

        let mut root_dim = 2i32.pow(self.root_id.fetch_from(&self.space).level());
        while x < self.rootX || y < self.rootY || x >= self.rootX + root_dim || y >= self.rootY + root_dim {
            self.root_id = self.space.expand_tree(self.root_id);
            self.rootX -= root_dim/2;
            self.rootY -= root_dim/2;
            root_dim = 2i32.pow(self.root_id.fetch_from(&self.space).level());
        }
        
        let adjusted_x = x - self.rootX;
        let adjusted_y = y - self.rootY;

        // Set cell relative to top left corner of space
        self.root_id = self.space.set_tree_pos(self.root_id, adjusted_x as usize, adjusted_y as usize, 1);
    }

    pub fn coords(&mut self, min_x: i32, min_y: i32, max_x: i32, max_y: i32) -> Array{
        let coords = self.space.get_coords(
            self.root_id,
            self.rootX, self.rootY,
            min_x, min_y,
            max_x, max_y
        );
        let mut results: Vec<i32> = vec![];
        for (cx, cy) in coords {
            results.push(cx);
            results.push(cy);
        }
        results.into_iter().map(JsValue::from).collect()
    }

    pub fn advance(&mut self, steps: usize) {
        let mut tid = self.root_id;
        loop {
            let tree = tid.fetch_node(&self.space);
        //     // let iroot = self.root.unwrap().inode(self);
            let (nw_pop, ne_pop, sw_pop, se_pop) = (
                tree.north_west.fetch_from(&self.space).population(),
                tree.north_east.fetch_from(&self.space).population(),
                tree.south_west.fetch_from(&self.space).population(),
                tree.south_east.fetch_from(&self.space).population(),
            );

            let (nw_inner_pop, ne_inner_pop, sw_inner_pop, se_inner_pop) = (
                tree
                    .north_west
                    .fetch_node(&self.space)
                    .south_east
                    .fetch_node(&self.space)
                    .south_east
                    .fetch_from(&self.space)
                    .population(),
                tree
                    .north_east
                    .fetch_node(&self.space)
                    .south_west
                    .fetch_node(&self.space)
                    .south_west
                    .fetch_from(&self.space)
                    .population(),
                tree
                    .south_west
                    .fetch_node(&self.space)
                    .north_east
                    .fetch_node(&self.space)
                    .north_east
                    .fetch_from(&self.space)
                    .population(),
                tree
                    .south_east
                    .fetch_node(&self.space)
                    .north_west
                    .fetch_node(&self.space)
                    .north_west
                    .fetch_from(&self.space)
                    .population(),
            );

            if tid.fetch_from(&self.space).level() >= 3
                && nw_pop == nw_inner_pop
                && ne_pop == ne_inner_pop
                && sw_pop == sw_inner_pop
                && se_pop == se_inner_pop
            {
                break;
            }

            let root_dim = 2i32.pow(tid.fetch_from(&self.space).level());
            tid = self.space.expand_tree(tid);
            self.rootX -= root_dim/2;
            self.rootY -= root_dim/2;
            
        }
        // self.root_id = tid;
        let rd = 2i32.pow(tid.fetch_from(&self.space).level() - 1);
        self.root_id = self.space.evolve_tree(tid);
        self.rootX += rd/2;
        self.rootY += rd/2;
    }
    
    pub fn root_level(&self) -> u32 {
        self.root_id.fetch_from(&self.space).level()
    }
    
    /// Get the minimum X coordinate contained in the Universe
    pub fn root_x(&self) -> i32 {
        self.rootX
    }
    
    /// Get the minimum Y coordinate contained in the Universe
    pub fn root_y(&self) -> i32 {
        self.rootY
    }
}
