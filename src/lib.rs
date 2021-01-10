mod gol;
mod utils;

// #![allow(dead_code)]
use js_sys::Array;
use regex::Regex;
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
    root_id: gol::ID,
}

#[wasm_bindgen]
impl Universe {
    /// Universe constructor
    pub fn new(rx: i32, ry: i32) -> Universe {
        let mut space = gol::Space::new();
        let root_id = space.empty_tree(3);
        Universe {
            rootX: rx,
            rootY: ry,
            space: space,
            root_id: root_id,
        }
    }

    #[wasm_bindgen]
    pub fn from_rle(&mut self, rle_str: String) {
        let rows = rle_str.split("\n");
        let pattern_data_re = Regex::new(r"^[#|x|x=]").unwrap();
        let header_pat = Regex::new(r"x\s*=\s*[0-9]+|y\s*=\s*[0-9]+|rule\s*=.+/").unwrap();
    
        let mut data_lines = vec![];
        let mut header_lines = vec![];
    
        for row in rows {
            if header_pat.is_match(row) {
                header_lines.push(row);
            }
            if !pattern_data_re.is_match(row.trim()) {
                data_lines.push(row);
            }
        }
    
        let header_data_pat = Regex::new(r"x\s*=\s*[0-9]+|y\s*=\s*[0-9]+|rule\s*=.+").unwrap();
        let header_data: Vec<&str> = header_data_pat.find_iter(header_lines[0]).map(|m| m.as_str()).collect();
        
        // pattern width & height:
        let width = header_data[0].split('=').last().unwrap().trim().parse::<i32>().unwrap();
        let height = header_data[1].split('=').last().unwrap().trim().parse::<i32>().unwrap();
    
        
        let pattern_data = data_lines.join("").to_string();
        let token_pat = Regex::new(r"[0-9]+|o|b|!|\$").unwrap();
        let tokens: Vec<&str> = token_pat.find_iter(&pattern_data).map(|m| m.as_str()).filter(|m| !m.is_empty()).collect();
        
        let digit_pat = Regex::new(r"[0-9]+").unwrap();
        let mut curr_num = 1;
        let mut coords: Vec<(i32, i32)> = vec![];
        let mut x = 0;
        let mut y = 0;
        
        for token in tokens {
            if digit_pat.is_match(token) {
                curr_num = token.parse::<i32>().unwrap();
            } else if token == "o" {
                for i in x..(x + curr_num) {
                    println!("C: i:{:?} x:{:?} curr_num: {:?}", i, x, curr_num);
                    coords.push((i, y));
                    self.set(i, y);
                }
                println!("---------");
                x += curr_num;
                curr_num = 1
            } else if token == "b" {
                x += curr_num;
                curr_num = 1;
            } else if token == "$" {
                for _ in 0..(curr_num - 1) {
                    y += 1;
                }
                x = 0;
                y += 1;
                println!("Y: {:?}", y);
                curr_num = 1;
            }
        }

    }

    pub fn set(&mut self, x: i32, y: i32) {
        let mut root_dim = 2i32.pow(self.root_id.fetch_from(&self.space).level() as u32);
        while x < self.rootX
            || y < self.rootY
            || x >= self.rootX + root_dim
            || y >= self.rootY + root_dim
        {
            self.root_id = self.space.expand_tree(self.root_id);
            self.rootX -= root_dim / 2;
            self.rootY -= root_dim / 2;
            root_dim = 2i32.pow(self.root_id.fetch_from(&self.space).level() as u32);
        }
        let adjusted_x = x - self.rootX;
        let adjusted_y = y - self.rootY;

        // Set cell relative to top left corner of space
        self.root_id = self
            .space
            .set_tree_pos(self.root_id, adjusted_x as usize, adjusted_y as usize, 1);
    }


    pub fn coords(&mut self, min_x: i32, min_y: i32, max_x: i32, max_y: i32) -> Array {
        let coords = self.space.get_coords(
            self.root_id,
            self.rootX,
            self.rootY,
            min_x,
            min_y,
            max_x,
            max_y,
        );
        let mut results: Vec<i32> = vec![];
        for (cx, cy) in coords {
            results.push(cx);
            results.push(cy);
        }
        results.into_iter().map(JsValue::from).collect()
    }

    pub fn center(&mut self, n: usize) {
        let mut tid = self.root_id;
        loop {
            let tree = tid.fetch_node(&self.space);

            let (nw_pop, ne_pop, sw_pop, se_pop) = (
                tree.north_west.fetch_from(&self.space).population(),
                tree.north_east.fetch_from(&self.space).population(),
                tree.south_west.fetch_from(&self.space).population(),
                tree.south_east.fetch_from(&self.space).population(),
            );

            let (nw_inner_pop, ne_inner_pop, sw_inner_pop, se_inner_pop) = (
                tree.north_west
                    .fetch_node(&self.space)
                    .south_east
                    .fetch_node(&self.space)
                    .south_east
                    .fetch_from(&self.space)
                    .population(),
                tree.north_east
                    .fetch_node(&self.space)
                    .south_west
                    .fetch_node(&self.space)
                    .south_west
                    .fetch_from(&self.space)
                    .population(),
                tree.south_west
                    .fetch_node(&self.space)
                    .north_east
                    .fetch_node(&self.space)
                    .north_east
                    .fetch_from(&self.space)
                    .population(),
                tree.south_east
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

            let root_dim = 2i32.pow(tid.fetch_from(&self.space).level() as u32);
            tid = self.space.expand_tree(tid);
            self.rootX -= root_dim / 2;
            self.rootY -= root_dim / 2;
        }
        self.root_id = tid;
    }

    pub fn advance(&mut self, steps: usize) {
        self.center(0);
        let mut tid = self.root_id;
        let mut bits = vec![];
        let mut steps_count = steps;
        // while steps_count > 0 {
        //     bits.push(steps_count & 1);
        //     steps_count = steps_count >> 1;
        //     let root_dim = 2i32.pow(tid.fetch_from(&self.space).level() as u32);
        //     tid = self.space.expand_tree(tid);
        //     self.rootX -= root_dim / 2;
        //     self.rootY -= root_dim / 2;
        // }
        // self.center(0);

        let mut k = 0;
        for bit in bits.iter().rev() {
            let j = bits.len() - k - 1;
            if *bit != 0 {
                let rd = 2i32.pow(tid.fetch_from(&self.space).level() as u32 - 1);
                // self.center(0);
                // tid = self.space.expand_tree(tid);
                // self.rootX -= rd/2;
                // self.rootY -= rd/2;
                tid = self.space.evolve_tree(tid, steps);
                self.rootX += rd / 2;
                self.rootY += rd / 2;
            }
        }
        self.root_id = tid
    }
    pub fn root_level(&self) -> usize {
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
