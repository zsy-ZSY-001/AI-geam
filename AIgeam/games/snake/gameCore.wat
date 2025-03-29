(module
  ;; 导入内存
  (import "env" "memory" (memory 1))
  
  ;; 导出函数
  (export "checkCollision" (func $checkCollision))
  (export "updatePosition" (func $updatePosition))
  (export "calculateScore" (func $calculateScore))
  
  ;; 检查碰撞
  (func $checkCollision (param $headX i32) (param $headY i32) 
                       (param $snakePtr i32) (param $snakeLen i32) (result i32)
    (local $i i32)
    (local $currentX i32)
    (local $currentY i32)
    
    (local.set $i (i32.const 0))
    
    (block $check_loop
      (loop $continue
        ;; 检查是否已经遍历完所有蛇身
        (br_if $check_loop (i32.ge_u (local.get $i) (local.get $snakeLen)))
        
        ;; 获取当前段的坐标
        (local.set $currentX (i32.load (i32.add (local.get $snakePtr) 
                                               (i32.mul (local.get $i) (i32.const 8)))))
        (local.set $currentY (i32.load (i32.add (i32.add (local.get $snakePtr) 
                                                        (i32.mul (local.get $i) (i32.const 8)))
                                              (i32.const 4))))
        
        ;; 检查碰撞
        (if (i32.and (i32.eq (local.get $headX) (local.get $currentX))
                     (i32.eq (local.get $headY) (local.get $currentY)))
          (then
            (return (i32.const 1))
          )
        )
        
        ;; 增加计数器
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $continue)
      )
    )
    
    (i32.const 0)
  )
  
  ;; 更新位置
  (func $updatePosition (param $x i32) (param $y i32) (param $direction i32) 
                       (param $gridSize i32) (result i32 i32)
    (local $newX i32)
    (local $newY i32)
    
    (local.set $newX (local.get $x))
    (local.set $newY (local.get $y))
    
    (block $update
      (block $right
        (block $left
          (block $down
            (block $up
              (br_table $up $down $left $right (local.get $direction))
            )
            ;; 向上移动
            (local.set $newY (i32.sub (local.get $y) (i32.const 1)))
            (br $update)
          )
          ;; 向下移动
          (local.set $newY (i32.add (local.get $y) (i32.const 1)))
          (br $update)
        )
        ;; 向左移动
        (local.set $newX (i32.sub (local.get $x) (i32.const 1)))
        (br $update)
      )
      ;; 向右移动
      (local.set $newX (i32.add (local.get $x) (i32.const 1)))
    )
    
    ;; 处理边界环绕
    (if (i32.lt_s (local.get $newX) (i32.const 0))
      (then (local.set $newX (i32.sub (local.get $gridSize) (i32.const 1))))
    )
    (if (i32.ge_s (local.get $newX) (local.get $gridSize))
      (then (local.set $newX (i32.const 0)))
    )
    (if (i32.lt_s (local.get $newY) (i32.const 0))
      (then (local.set $newY (i32.sub (local.get $gridSize) (i32.const 1))))
    )
    (if (i32.ge_s (local.get $newY) (local.get $gridSize))
      (then (local.set $newY (i32.const 0)))
    )
    
    (local.get $newX)
    (local.get $newY)
  )
  
  ;; 计算分数
  (func $calculateScore (param $baseScore i32) (param $multiplier i32) 
                       (param $bonus i32) (result i32)
    (i32.add 
      (i32.mul (local.get $baseScore) (local.get $multiplier))
      (local.get $bonus)
    )
  )
) 